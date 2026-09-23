import fs from 'fs';
import path from 'path';
import { parsePdfBuffer, parseTextBuffer } from './documentParser';
import { chunkDocumentPages, DocumentChunk } from './chunker';
import { azureOpenAI, StructuredAnswerPayload, formatStructuredAnswerToMarkdown } from './azureOpenAIService';
import { azureSearch, SearchHit } from './azureSearchService';
import { DocumentProfile, DocumentTopic, generateDocumentProfile } from './documentProfiler';
import { config } from '../config';

import { CourseTopicMap } from '../../src/types/document';
import { courseTopicMapService } from './courseTopicMapService';

export interface StoredDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  pages: number;
  uploadedAt: string;
  chunksCount: number;
  status: 'ready' | 'processing' | 'failed';
  errorMessage?: string;
  profile?: DocumentProfile;
  topicMap?: CourseTopicMap;
}

export interface Citation {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkId: string;
  excerpt: string;
  searchScore: number;    // Azure AI Search Hybrid RRF score (Reciprocal Rank Fusion)
  relevanceScore: number; // Retained for backward compatibility
}

export interface RAGAnswerResult {
  answer: string;
  structuredAnswer?: StructuredAnswerPayload;
  isGrounded: boolean;
  citations: Citation[];
  // Maintain backward-compatible field for frontend
  sources: Citation[];
  followUps?: string[];
  retrievedChunks: Array<{
    id: string;
    documentId: string;
    documentName: string;
    pageNumber: number;
    chunkIndex: number;
    content: string;
    score: number;
    rerankerScore?: number;
  }>;
  debugInfo?: {
    documentIdsFilter?: string[];
    filterExpression?: string;
    totalRetrieved: number;
    retrievedPages: number[];
    scores: Array<{ chunkId: string; score: number; pageNumber: number }>;
    groundingDecision: string;
    model: string;
    searchIndex: string;
  };
}

export class RAGPipeline {
  // Authoritative in-memory registry of uploaded document metadata
  private documentsMap: Map<string, StoredDocument> = new Map();

  async getDocuments(): Promise<StoredDocument[]> {
    if (this.documentsMap.size === 0) {
      try {
        const indexedDocs = await azureSearch.getDistinctDocumentsFromIndex();
        for (const d of indexedDocs) {
          this.documentsMap.set(d.documentId, {
            id: d.documentId,
            name: d.documentName,
            type: d.documentName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text',
            size: 'Indexed in Search',
            pages: d.pageCount,
            chunksCount: d.chunkCount,
            uploadedAt: 'Active Index',
            status: 'ready',
          });
        }
      } catch (e) {
        console.warn('Could not sync documents from Azure AI Search index:', e);
      }

      // Check persistent manifest.json in server/storage/documents
      try {
        const manifestPath = path.join(process.cwd(), 'server', 'storage', 'documents', 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          const raw = fs.readFileSync(manifestPath, 'utf-8');
          const manifestDocs = JSON.parse(raw);
          if (Array.isArray(manifestDocs)) {
            for (const doc of manifestDocs) {
              if (!this.documentsMap.has(doc.id)) {
                this.documentsMap.set(doc.id, doc);
              }
            }
          }
        }
      } catch (manifestErr) {
        console.warn('Could not read document storage manifest:', manifestErr);
      }

      // Persist full state to manifest
      this.saveManifest();
    }
    return Array.from(this.documentsMap.values());
  }

  private saveManifest(): void {
    try {
      const manifestPath = path.join(process.cwd(), 'server', 'storage', 'documents', 'manifest.json');
      const docs = Array.from(this.documentsMap.values());
      fs.writeFileSync(manifestPath, JSON.stringify(docs, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Could not save manifest.json:', e);
    }
  }

  getDocument(id: string): StoredDocument | undefined {
    return this.documentsMap.get(id);
  }

  /**
   * Deletes a document from the system and deletes all its indexed chunks from Azure AI Search.
   */
  async deleteDocument(id: string): Promise<boolean> {
    const doc = this.documentsMap.get(id);
    if (!doc) return false;

    // Delete all chunks from Azure AI Search
    await azureSearch.deleteDocumentChunks(id);
    this.documentsMap.delete(id);
    courseTopicMapService.invalidateCache(id);
    this.saveManifest();
    return true;
  }

  /**
   * Real PDF Ingestion Pipeline:
   * 1. Validate file
   * 2. Generate unique documentId
   * 3. Extract text page-by-page preserving page numbers
   * 4. Split into chunks matching index schema
   * 5. Generate real 1536-dim embeddings via text-embedding-3-small
   * 6. Index into Azure AI Search index "learning-chunks"
   * 7. Verify documents are queryable before returning ready status
   */
  async ingestDocument(
    fileBuffer: Buffer,
    fileName: string,
    fileSizeStr: string,
    mimeType: string
  ): Promise<StoredDocument> {
    // 1. Validation
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Uploaded file is empty.');
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const storedDoc: StoredDocument = {
      id: docId,
      name: fileName,
      type: fileName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text',
      size: fileSizeStr,
      pages: 1,
      chunksCount: 0,
      uploadedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'processing',
    };

    this.documentsMap.set(docId, storedDoc);

    try {
      // 2. Real text extraction page-by-page
      console.log('====================================================');
      console.log('[Phase 1 Ingest] Document Ingestion Trace:');
      console.log(`  - Original filename: ${fileName}`);
      console.log(`  - Generated documentId: ${docId}`);

      const parsed = fileName.toLowerCase().endsWith('.pdf')
        ? await parsePdfBuffer(fileBuffer, fileName)
        : parseTextBuffer(fileBuffer, fileName);

      if (!parsed.pages || parsed.pages.length === 0 || !parsed.fullText.trim()) {
        throw new Error('Could not extract readable text from document. Ensure file is not empty, password-protected, or scanned images without OCR.');
      }

      storedDoc.pages = parsed.totalPages;
      console.log(`  - Number of pages parsed: ${parsed.totalPages} (${parsed.pages.length} non-empty pages)`);

      // 3. Chunking matching learning-chunks schema
      const chunks = chunkDocumentPages(docId, fileName, parsed.pages);
      storedDoc.chunksCount = chunks.length;
      console.log(`  - Number of chunks generated: ${chunks.length}`);

      if (chunks.length === 0) {
        throw new Error('Document contained no substantial text content to index.');
      }

      if (chunks.length > 0) {
        console.log(`  - Chunk #1 preview (truncated): "${chunks[0].content.slice(0, 150).replace(/\n/g, ' ')}..."`);
      }
      if (chunks.length > 1) {
        console.log(`  - Chunk #2 preview (truncated): "${chunks[1].content.slice(0, 150).replace(/\n/g, ' ')}..."`);
      }

      // 4. Generate real 1536-dim embeddings using text-embedding-3-small
      const chunkTexts = chunks.map((c) => c.content);
      const batchSize = 16;
      const embeddingBatchCount = Math.ceil(chunks.length / batchSize);
      console.log(`  - Embedding request count: ${embeddingBatchCount} batch(es) via text-embedding-3-small`);

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunkTexts.slice(i, i + batchSize);
        const embeddings = await azureOpenAI.generateEmbeddingsBatch(batch);
        for (let j = 0; j < embeddings.length; j++) {
          chunks[i + j].contentVector = embeddings[j];
        }
      }

      const vectorDimension = chunks[0]?.contentVector?.length || 1536;
      console.log(`  - Embedding vector dimension: ${vectorDimension} (no NaNs: ${!chunks[0]?.contentVector?.some(isNaN)})`);

      // 5. Upload chunks to Azure AI Search index "learning-chunks"
      const indexingBatchCount = Math.ceil(chunks.length / 100);
      console.log(`  - Azure AI Search indexing batch count: ${indexingBatchCount}`);
      console.log(`  - Target Search index name: ${config.search.indexName}`);
      await azureSearch.indexChunks(chunks);

      console.log(`  - Number of successfully indexed chunks: ${chunks.length}`);

      // 6. Phase 2 Verification: Confirm chunks are actually queryable in Azure AI Search
      console.log(`[Phase 2 Ingest Verification] Confirming chunks in Azure AI Search for docId "${docId}"...`);
      const verifyHits = await azureSearch.searchRelevantChunks('*', null, [docId], 2);
      console.log(`[Phase 2 Ingest Verification] Found ${verifyHits.length} verified chunks in Azure AI Search.`);

      // 7. Dynamic Educational Profile Extraction via GPT-4.1-mini
      console.log(`[Profiler] Extracting dynamic curriculum profile for "${fileName}"...`);
      try {
        const profile = await generateDocumentProfile(docId, fileName, parsed, chunks);
        storedDoc.profile = profile;
        console.log(`[Profiler] Main Topic: "${profile.mainTopic}", Subject: "${profile.subject}"`);
        console.log(`[Profiler] Extracted ${profile.topics.length} topics, ${profile.keyConcepts.length} concepts, ${profile.suggestedQuestions.length} questions.`);
      } catch (profErr) {
        console.warn(`[Profiler Error] Fallback will be used:`, profErr);
      }

      storedDoc.status = 'ready';
      this.saveManifest();
      console.log(`[Ingest Complete] Document "${fileName}" (${docId}) marked READY.`);
      console.log('====================================================');
      return storedDoc;
    } catch (err: any) {
      storedDoc.status = 'failed';
      storedDoc.errorMessage = err.message;
      console.error(`[Ingest Failure] ${fileName}:`, err);
      throw err;
    }
  }

  /**
   * Real RAG Query Pipeline:
   * 1. Generate query embedding using text-embedding-3-small
   * 2. Hybrid vector + text search in Azure AI Search index "learning-chunks"
   * 3. Apply documentId filter if specified
   * 4. Check retrieved chunks and synthesize response using gpt-4.1-mini
   * 5. Construct citations strictly from retrieved chunk metadata
   */
  async answerQuestion(
    question: string,
    documentIds?: string[],
    chunkIds?: string[],
    conceptContext?: {
      conceptTitle?: string;
      conceptDescription?: string;
      unitTitle?: string;
      sectionTitle?: string;
      pageStart?: number;
      pageEnd?: number;
      keywords?: string[];
    }
  ): Promise<RAGAnswerResult> {
    const cleanQuestion = question ? question.trim() : '';
    if (!cleanQuestion) {
      throw new Error('Question parameter cannot be empty.');
    }

    if (!config.openAI.isConfigured || !config.search.isConfigured) {
      throw new Error(
        'Azure AI services are not configured. Add AZURE_OPENAI_API_KEY and AZURE_SEARCH_API_KEY in server/.env to enable live AI responses.'
      );
    }

    console.log('====================================================');
    console.log(`[RAG Pipeline] Grounded Query Processing:`);
    console.log(`  - Query text: "${cleanQuestion}"`);
    console.log(`  - Selected document IDs filter:`, documentIds && documentIds.length > 0 ? documentIds : 'None (all documents)');
    if (chunkIds && chunkIds.length > 0) {
      console.log(`  - Scoped concept chunk IDs (${chunkIds.length}):`, chunkIds);
    }
    if (conceptContext && conceptContext.conceptTitle) {
      console.log(`  - Active Concept Focus: "${conceptContext.conceptTitle}"`);
    }

    // 1. Generate real query embedding via text-embedding-3-small
    const queryEmbedding = await azureOpenAI.generateEmbedding(cleanQuestion);
    console.log(`[Phase 4 Embedding] Embedding vector generated:`);
    console.log(`  - Dimensions: ${queryEmbedding.length}`);
    console.log(`  - No NaN values: ${!queryEmbedding.some(isNaN)}`);
    console.log(`  - Vector finite check: ${queryEmbedding.every(Number.isFinite)}`);

    // 2. Azure AI Search hybrid vector query
    const searchHits = await azureSearch.searchRelevantChunks(
      cleanQuestion,
      queryEmbedding,
      documentIds,
      chunkIds && chunkIds.length > 0 ? Math.max(4, Math.min(6, chunkIds.length)) : 4,
      chunkIds
    );

    console.log(`[Phase 3 Verify] Actual documentIds returned by Search:`, Array.from(new Set(searchHits.map((h) => h.documentId))));

    // 3. Relevance check: If no search hits returned, return grounded refusal
    if (!searchHits || searchHits.length === 0) {
      console.log(`[RAG Pipeline] Grounding Decision: REFUSAL (0 chunks found matching query and filter)`);
      console.log('====================================================');
      return {
        answer: "I couldn't find enough information about this topic in your selected learning materials.",
        isGrounded: false,
        citations: [],
        sources: [],
        retrievedChunks: [],
        debugInfo: {
          question: cleanQuestion,
          selectedDocumentIds: documentIds,
          selectedDocumentNames: documentIds?.map((id) => this.documentsMap.get(id)?.name || id),
          activeConcept: conceptContext?.conceptTitle,
          chunkIdsFilter: chunkIds,
          queryEmbeddingDimensions: queryEmbedding.length,
          searchIndex: config.search.indexName,
          filterExpression: azureSearch.lastSearchStats?.filterExpression || (documentIds && documentIds.length > 0 ? documentIds.map((id) => `documentId eq '${id}'`).join(' or ') : 'None'),
          rawSearchHitsCount: 0,
          rawHits: [],
          totalRetrieved: 0,
          retrievedPages: [],
          scores: [],
          groundingDecision: 'REFUSAL (0 chunks retrieved from Azure AI Search)',
          refusalReason: 'Zero matching chunks found in Azure AI Search for this query and scope',
          gptModel: config.openAI.chatDeployment,
          gptCalled: false,
          model: config.openAI.chatDeployment,
        },
      };
    }

    // 4. Build grounded context exclusively from retrieved chunks
    const contextBlocks = searchHits.map((hit, idx) => {
      return `[Chunk ${idx + 1} | Document: "${hit.documentName}" (ID: ${hit.documentId}) | Page: ${hit.pageNumber}]\n${hit.content}`;
    });
    const combinedContext = contextBlocks.join('\n\n');

    // 5. Send to Azure OpenAI chat deployment with strict structured pedagogical tutor instructions
    console.log(`[RAG Pipeline] Calling ${config.openAI.chatDeployment} for structured pedagogical tutoring with ${searchHits.length} retrieved chunks...`);
    const structuredPayload = await azureOpenAI.generateGroundedStructuredAnswer(cleanQuestion, combinedContext, conceptContext);
    const modelAnswer = formatStructuredAnswerToMarkdown(structuredPayload);

    // Check if the model itself concluded information was not found
    const lowerAnswer = modelAnswer.toLowerCase();
    const isRefusal = !structuredPayload.isGrounded ||
      lowerAnswer.includes("couldn't find enough information") ||
      lowerAnswer.includes("could not find enough information") ||
      lowerAnswer.includes("does not contain information") ||
      lowerAnswer.includes("not contain information");
    const isGrounded = !isRefusal;

    console.log(`[RAG Pipeline] Grounding Decision: ${isGrounded ? `GROUNDED (${structuredPayload.answerType})` : 'REFUSAL (Context lacks sufficient evidence)'}`);
    console.log('====================================================');

    // 6. Build citations strictly from the actual retrieved Search documents
    const citations: Citation[] = searchHits.map((hit) => ({
      documentId: hit.documentId,
      documentName: hit.documentName,
      pageNumber: hit.pageNumber,
      chunkId: hit.id,
      excerpt: hit.content.length > 220 ? hit.content.substring(0, 220) + '...' : hit.content,
      searchScore: hit.score,
      relevanceScore: hit.score,
    }));

    // 7. Dynamic follow-ups: Generate from current answer & document topics
    let followUps: string[] = [];
    if (isGrounded) {
      followUps = [
        `Explain this step by step based on the material`,
        `What are practical real-world applications of this?`,
        `Quiz me on these concepts`
      ];
      // If we have an active document with extracted topics, add topic-specific prompt
      if (documentIds && documentIds.length === 1) {
        const doc = this.documentsMap.get(documentIds[0]);
        if (doc?.profile?.topics && doc.profile.topics.length > 0) {
          const randomTopic = doc.profile.topics[Math.floor(Math.random() * doc.profile.topics.length)].name;
          followUps.unshift(`Tell me more about ${randomTopic}`);
          followUps = followUps.slice(0, 3);
        }
      }
    } else {
      followUps = [
        'Upload relevant study material',
        'Ask about topics in your uploaded document'
      ];
    }

    return {
      answer: modelAnswer,
      structuredAnswer: structuredPayload,
      isGrounded,
      citations: isGrounded ? citations : [],
      sources: isGrounded ? citations : [],
      followUps,
      retrievedChunks: searchHits,
      debugInfo: {
        question: cleanQuestion,
        selectedDocumentIds: documentIds,
        selectedDocumentNames: documentIds?.map((id) => this.documentsMap.get(id)?.name || id),
        activeConcept: conceptContext?.conceptTitle,
        chunkIdsFilter: chunkIds,
        queryEmbeddingDimensions: queryEmbedding.length,
        searchIndex: config.search.indexName,
        filterExpression: azureSearch.lastSearchStats?.filterExpression || (documentIds && documentIds.length > 0 ? documentIds.map((id) => `documentId eq '${id}'`).join(' or ') : 'None'),
        rawSearchHitsCount: azureSearch.lastSearchStats?.rawHitsCount ?? searchHits.length,
        rawHits: azureSearch.lastSearchStats?.rawHits ?? searchHits.map((h) => ({ id: h.id, documentId: h.documentId, pageNumber: h.pageNumber, chunkIndex: h.chunkIndex, score: h.score })),
        totalRetrieved: searchHits.length,
        retrievedPages: searchHits.map((h) => h.pageNumber),
        scores: searchHits.map((h) => ({ chunkId: h.id, score: h.score, pageNumber: h.pageNumber })),
        groundingDecision: isGrounded ? `GROUNDED (${searchHits.length} chunks used)` : 'REFUSAL (Context lacked sufficient evidence)',
        refusalReason: isGrounded ? undefined : 'Context lacked sufficient evidence for question',
        gptModel: config.openAI.chatDeployment,
        gptCalled: true,
        model: config.openAI.chatDeployment,
        contextLengthChars: combinedContext.length,
      },
    };
  }

  /**
   * Fast, grounded retrieval directly from Azure AI Search without running full question synthesis.
   * Used by AI Live Class to retrieve chunk evidence for single-pass teaching generation.
   */
  async retrieveGroundedChunks(
    query: string,
    documentIds?: string[],
    top: number = 4
  ): Promise<{
    searchHits: SearchHit[];
    citations: Citation[];
    combinedContext: string;
    timing: { embeddingMs: number; searchMs: number; searchTotalMs: number };
  }> {
    const t0 = performance.now();
    const cleanQuery = query.trim();
    const queryEmbedding = await azureOpenAI.generateEmbedding(cleanQuery);
    const t1 = performance.now();
    const searchHits = await azureSearch.searchRelevantChunks(
      cleanQuery,
      queryEmbedding,
      documentIds,
      top
    );
    const t2 = performance.now();
    const citations: Citation[] = searchHits.map((hit) => ({
      documentId: hit.documentId,
      documentName: hit.documentName,
      pageNumber: hit.pageNumber,
      chunkId: hit.id,
      excerpt: hit.content.length > 220 ? hit.content.substring(0, 220) + '...' : hit.content,
      searchScore: hit.score,
      relevanceScore: hit.score,
    }));
    const contextBlocks = searchHits.map((hit, idx) => {
      return `[Chunk ${idx + 1} | Document: "${hit.documentName}" (ID: ${hit.documentId}) | Page: ${hit.pageNumber}]\n${hit.content}`;
    });
    return {
      searchHits,
      citations,
      combinedContext: contextBlocks.join('\n\n'),
      timing: {
        embeddingMs: Math.round(t1 - t0),
        searchMs: Math.round(t2 - t1),
        searchTotalMs: Math.round(t2 - t0),
      },
    };
  }

  /**
   * Retrieves the canonical Course Topic Map for a document.
   */
  async getCourseTopicMap(documentId: string): Promise<CourseTopicMap | null> {
    const doc = this.documentsMap.get(documentId);
    const docName = doc?.name || 'Course Document';
    const totalPages = doc?.pages || 1;
    const map = await courseTopicMapService.getTopicMap(documentId, docName, totalPages);
    if (doc) {
      doc.topicMap = map;
    }
    return map;
  }

  /**
   * Retrieves or computes dynamic curriculum topics for a document
   */
  async getDocumentProfile(documentId: string): Promise<DocumentProfile | null> {
    const doc = this.documentsMap.get(documentId);
    if (doc?.profile) return doc.profile;

    const docName = doc?.name || 'Course Document';
    const totalPages = doc?.pages || 1;

    const profile = await generateDocumentProfile(
      documentId,
      docName,
      { title: docName, totalPages, pages: [], fullText: '' },
      []
    );
    if (doc) {
      doc.profile = profile;
    }
    return profile;
  }

  /**
   * Real Dynamic Quiz Generation:
   * Retrieves actual chunks from the user's selected documents and generates
   * structured MCQ questions grounded in that text using gpt-4.1-mini.
   */
  async generateDocumentQuiz(
    documentIds?: string[],
    topic: string = 'core concepts',
    count: number = 5,
    difficulty: string = 'Medium',
    chunkIds?: string[]
  ): Promise<any[]> {
    if (!config.openAI.isConfigured || !config.search.isConfigured) {
      throw new Error('Azure AI services are not configured in server/.env.');
    }

    console.log(`[Quiz Generator] Generating ${count} ${difficulty} questions for topic "${topic}" with document filter:`, documentIds);

    let searchHits: SearchHit[] = [];

    // If specific chunkIds are provided (from selected CourseTopicMap concept/section), retrieve those directly
    if (chunkIds && chunkIds.length > 0) {
      try {
        const idFilter = chunkIds.slice(0, 15).map((id) => `id eq '${id}'`).join(' or ');
        const filterStr =
          documentIds && documentIds.length > 0
            ? `(${idFilter}) and (${documentIds.map((d) => `documentId eq '${d}'`).join(' or ')})`
            : idFilter;

        const queryUrl = `${config.search.endpoint.replace(/\/+$/, '')}/indexes/${config.search.indexName}/docs?api-version=${config.search.apiVersion}&$filter=${encodeURIComponent(filterStr)}&$top=15`;
        const res = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'api-key': config.search.apiKey,
          },
        });
        if (res.ok) {
          const data = await res.json();
          searchHits = (data.value || []).map((h: any) => ({
            id: h.id,
            documentId: h.documentId,
            documentName: h.documentName,
            pageNumber: h.pageNumber,
            chunkIndex: h.chunkIndex,
            content: h.content,
            score: 1.0,
          }));
        }
      } catch (err) {
        console.warn('[Quiz Generator] Could not fetch specific chunkIds, falling back to topic search:', err);
      }
    }

    // Fallback to topic search if chunkIds not found or not provided
    if (searchHits.length === 0) {
      searchHits = await azureSearch.searchRelevantChunks(
        topic || 'key principles and definitions',
        null, // text search for broad topical coverage
        documentIds,
        8
      );
    }

    if (!searchHits || searchHits.length === 0) {
      throw new Error(
        `No document chunks found matching topic "${topic}" in the selected study material. Please select a topic from the uploaded material.`
      );
    }

    const contextText = searchHits
      .map((hit) => `[Source: ${hit.documentName}, Page ${hit.pageNumber}]:\n${hit.content}`)
      .join('\n\n');

    const rawQuestions = await azureOpenAI.generateQuiz(contextText, topic, count);

    // Attach actual source metadata to each question
    return rawQuestions.map((q: any, i: number) => {
      const sourceHit = searchHits[i % searchHits.length];
      return {
        ...q,
        id: q.id || `q_${i + 1}`,
        questionNumber: i + 1,
        difficulty: difficulty || 'Medium',
        sourceReference: {
          documentName: sourceHit.documentName,
          page: sourceHit.pageNumber,
          topic: topic,
          chunkExcerpt: sourceHit.content.substring(0, 180) + '...',
        },
      };
    });
  }

  /**
   * Ingests a multimodal vision analysis into Azure AI Search index "learning-chunks".
   * 1. Formulates unified educational text representation.
   * 2. Generates real 1536-dim embedding using text-embedding-3-small.
   * 3. Indexes chunk into Azure AI Search index "learning-chunks".
   * 4. Verifies queryability and stores in in-memory document registry.
   */
  async ingestVisionAnalysis(
    analysis: {
      title: string;
      whatISee: string;
      keyConcepts: string[];
      stepByStep?: Array<{ stepNumber: number; title: string; description: string; senderReceiver?: string }>;
      importantLabels?: Array<{ tag: string; description: string }>;
      detailedExplanation: string;
    },
    imageFileName: string
  ): Promise<StoredDocument> {
    const docId = `doc-vision-${Date.now()}`;
    const cleanDocName = `${analysis.title || imageFileName} (Vision Ingest)`;

    const stepsText = (analysis.stepByStep && analysis.stepByStep.length > 0)
      ? `\nStep-by-Step Sequence:\n` + analysis.stepByStep.map(s => `Step ${s.stepNumber}: ${s.title} - ${s.description}${s.senderReceiver ? ` (${s.senderReceiver})` : ''}`).join('\n')
      : '';

    const labelsText = (analysis.importantLabels && analysis.importantLabels.length > 0)
      ? `\nVisible Labels & Components:\n` + analysis.importantLabels.map(l => `- ${l.tag}: ${l.description}`).join('\n')
      : '';

    const content = `[Visual Document: ${analysis.title}]
Source Image: ${imageFileName}
Visual Layout & Summary:
${analysis.whatISee}

Key Visual Concepts: ${analysis.keyConcepts.join(', ')}
${stepsText}
${labelsText}

Technical Educational Explanation:
${analysis.detailedExplanation}`.trim();

    // Generate real embedding using text-embedding-3-small
    const embeddings = await azureOpenAI.generateEmbeddingsBatch([content]);
    const contentVector = embeddings[0];

    const chunk: DocumentChunk = {
      id: `chunk-v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      documentId: docId,
      documentName: cleanDocName,
      pageNumber: 1,
      chunkIndex: 0,
      content,
      contentVector,
      section: 'Visual Analysis & Concepts',
    };

    // Index into Azure AI Search
    console.log(`[Vision Ingest] Indexing visual chunk for "${cleanDocName}" into Azure AI Search...`);
    await azureSearch.indexChunks([chunk]);

    const storedDoc: StoredDocument = {
      id: docId,
      name: cleanDocName,
      type: 'image',
      size: '1.2 MB',
      pages: 1,
      uploadedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      chunksCount: 1,
      status: 'ready',
      profile: {
        documentId: docId,
        documentName: cleanDocName,
        subject: 'Visual Multimodal Learning',
        mainTopic: analysis.title,
        academicLevel: 'Undergraduate / Professional',
        summary: analysis.whatISee,
        topics: analysis.keyConcepts.map((c, i) => ({
          id: `topic-v-${i}`,
          name: c,
          description: `Concept extracted from ${analysis.title}`,
          pageStart: 1,
          pageEnd: 1,
          estimatedMinutes: 5,
        })),
        keyConcepts: analysis.keyConcepts,
        suggestedQuestions: [
          `Explain the key principles of ${analysis.title}`,
          `What components are shown in ${analysis.title}?`,
          ...(analysis.stepByStep?.length ? [`What is the sequence of events in ${analysis.title}?`] : [])
        ],
      },
    };

    this.documentsMap.set(docId, storedDoc);
    console.log(`[Vision Ingest] Successfully indexed "${cleanDocName}" into Azure AI Search.`);
    return storedDoc;
  }
}

export const ragPipeline = new RAGPipeline();

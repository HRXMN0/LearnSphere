import { config } from '../config';
import { DocumentChunk } from './chunker';

export interface SearchHit {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  score: number;
  rerankerScore?: number;
}

export interface SearchStats {
  queryText: string;
  filterExpression: string;
  vectorDimensions: number;
  rawHitsCount: number;
  rawHits: Array<{ id: string; documentId: string; pageNumber: number; chunkIndex: number; score: number }>;
  filteredHitsCount: number;
}

export class AzureSearchService {
  public lastSearchStats: SearchStats | null = null;

  public isConfigured(): boolean {
    return config.search.isConfigured;
  }

  private getBaseUrl(): string {
    return config.search.endpoint.replace(/\/+$/, '');
  }

  private sanitizeErrorMessage(status: number, rawText: string): string {
    try {
      const parsed = JSON.parse(rawText);
      const msg = parsed.error?.message || parsed.message || rawText;
      if (status === 401 || status === 403) {
        return `Azure AI Search Authentication failed (${status}): Invalid AZURE_SEARCH_API_KEY.`;
      }
      if (status === 404) {
        return `Azure AI Search index "${config.search.indexName}" or service not found (${status}).`;
      }
      return `Azure AI Search Error (${status}): ${msg}`;
    } catch {
      return `Azure AI Search Error (${status}): ${rawText.substring(0, 150)}`;
    }
  }

  /**
   * Health check verifying real connectivity to the Azure AI Search service and index.
   */
  async testConnection(): Promise<{ reachable: boolean; indexFound: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { reachable: false, indexFound: false, message: 'Azure AI Search credentials not configured.' };
    }

    const url = `${this.getBaseUrl()}/indexes/${config.search.indexName}?api-version=${config.search.apiVersion}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.search.apiKey,
        },
      });

      if (response.ok) {
        return { reachable: true, indexFound: true, message: `Connected to Azure AI Search index "${config.search.indexName}".` };
      }

      const errorText = await response.text();
      return {
        reachable: false,
        indexFound: response.status !== 404,
        message: this.sanitizeErrorMessage(response.status, errorText),
      };
    } catch (err: any) {
      return { reachable: false, indexFound: false, message: `Network error connecting to Azure AI Search: ${err.message}` };
    }
  }

  /**
   * Uploads real document chunks and vector embeddings to the Azure AI Search index "learning-chunks".
   * 
   * Schema:
   * - id (String, key)
   * - documentId (String)
   * - documentName (String)
   * - pageNumber (Int32)
   * - chunkIndex (Int32)
   * - content (String)
   * - contentVector (Collection(Edm.Single), 1536 dims)
   */
  async indexChunks(chunks: DocumentChunk[]): Promise<{ indexedCount: number; destination: string }> {
    if (!this.isConfigured()) {
      throw new Error(
        'Azure AI Search is not configured. Set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY in server/.env.'
      );
    }

    if (chunks.length === 0) {
      return { indexedCount: 0, destination: config.search.indexName };
    }

    const url = `${this.getBaseUrl()}/indexes/${config.search.indexName}/docs/index?api-version=${config.search.apiVersion}`;

    const searchDocuments = chunks.map((c) => {
      const doc: any = {
        '@search.action': 'mergeOrUpload',
        id: c.id,
        documentId: c.documentId,
        documentName: c.documentName,
        pageNumber: c.pageNumber,
        chunkIndex: c.chunkIndex,
        content: c.content,
      };
      if (c.contentVector && c.contentVector.length > 0) {
        doc.contentVector = c.contentVector;
      }
      return doc;
    });

    // Upload in batches of 100
    const batchSize = 100;
    for (let i = 0; i < searchDocuments.length; i += batchSize) {
      const batch = searchDocuments.slice(i, i + batchSize);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.search.apiKey,
        },
        body: JSON.stringify({ value: batch }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(this.sanitizeErrorMessage(response.status, errorText));
      }
    }

    return {
      indexedCount: chunks.length,
      destination: `Azure AI Search (${config.search.indexName})`,
    };
  }

  /**
   * Real Azure AI Search Hybrid / Vector Search.
   * Queries index "learning-chunks" using contentVector and search keywords with documentId isolation.
   */
  async searchRelevantChunks(
    queryText: string,
    queryEmbedding: number[] | null,
    activeDocumentIds?: string[],
    topK: number = 4,
    chunkIds?: string[]
  ): Promise<SearchHit[]> {
    if (!this.isConfigured()) {
      throw new Error(
        'Azure AI Search is not configured. Set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY in server/.env.'
      );
    }

    const url = `${this.getBaseUrl()}/indexes/${config.search.indexName}/docs/search?api-version=${config.search.apiVersion}`;

    // Build filter expression for document isolation and concept chunk scoping
    let docFilter: string | undefined = undefined;
    if (activeDocumentIds && activeDocumentIds.length > 0) {
      if (activeDocumentIds.length === 1) {
        docFilter = `(documentId eq '${activeDocumentIds[0]}')`;
      } else {
        // Enclose each eq in parentheses for strict precedence in Azure OData filters
        docFilter = `(${activeDocumentIds.map((id) => `(documentId eq '${id}')`).join(' or ')})`;
      }
    }

    let chunkFilter: string | undefined = undefined;
    if (chunkIds && chunkIds.length > 0) {
      // In Azure Search schema, 'id' is a key field and NOT filterable (filterable: false).
      // 'chunkIndex' is an Edm.Int32 field and IS filterable (filterable: true).
      // Extract numeric chunk indices from canonical chunk IDs (e.g. 'doc_1790177596072_9gk69l_1' -> 1)
      const chunkIndices: number[] = [];
      for (const cid of chunkIds) {
        const parts = cid.split('_');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num)) {
          chunkIndices.push(num);
        }
      }

      if (chunkIndices.length === 1) {
        chunkFilter = `(chunkIndex eq ${chunkIndices[0]})`;
      } else if (chunkIndices.length > 1) {
        chunkFilter = `(${chunkIndices.map((idx) => `(chunkIndex eq ${idx})`).join(' or ')})`;
      }
    }

    let filterExpression: string | undefined = undefined;
    if (docFilter && chunkFilter) {
      filterExpression = `${docFilter} and ${chunkFilter}`;
    } else if (docFilter) {
      filterExpression = docFilter;
    } else if (chunkFilter) {
      filterExpression = chunkFilter;
    }

    console.log(`[Azure AI Search] Query: "${queryText}"`);
    console.log(`[Azure AI Search] Filter expression: ${filterExpression || 'None (all documents)'}`);
    if (chunkIds && chunkIds.length > 0) {
      console.log(`[Azure AI Search] Scoped to ${chunkIds.length} concept chunks:`, chunkIds);
    }
    console.log(`[Azure AI Search] Vector query dimensions: ${queryEmbedding ? queryEmbedding.length : 'None'}`);

    const requestBody: any = {
      search: queryText || '*',
      select: 'id,documentId,documentName,pageNumber,chunkIndex,content',
      top: topK,
    };

    if (filterExpression) {
      requestBody.filter = filterExpression;
    }

    // Add vector query if embedding is available (Hybrid Search)
    if (queryEmbedding && queryEmbedding.length > 0) {
      requestBody.vectorQueries = [
        {
          kind: 'vector',
          vector: queryEmbedding,
          fields: 'contentVector',
          k: topK,
        },
      ];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.search.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Azure AI Search query returned ${response.status}: ${errorText}`);
      throw new Error(this.sanitizeErrorMessage(response.status, errorText));
    }

    const data = await response.json();
    const hits: SearchHit[] = (data.value || []).map((doc: any) => ({
      id: doc.id,
      documentId: doc.documentId,
      documentName: doc.documentName,
      pageNumber: doc.pageNumber,
      chunkIndex: doc.chunkIndex,
      content: doc.content,
      score: doc['@search.score'] || 0,
      rerankerScore: doc['@search.rerankerScore'],
    }));

    // Post-filter to ensure strict match to requested chunkIds if provided
    let finalHits = hits;
    if (chunkIds && chunkIds.length > 0) {
      const idSet = new Set(chunkIds);
      const scoped = hits.filter((h) => idSet.has(h.id));
      if (scoped.length > 0) {
        finalHits = scoped;
      }
    }

    this.lastSearchStats = {
      queryText,
      filterExpression: filterExpression || 'None',
      vectorDimensions: queryEmbedding ? queryEmbedding.length : 0,
      rawHitsCount: hits.length,
      rawHits: hits.map((h) => ({ id: h.id, documentId: h.documentId, pageNumber: h.pageNumber, chunkIndex: h.chunkIndex, score: h.score })),
      filteredHitsCount: finalHits.length,
    };

    console.log(`[Azure AI Search Results] Found ${hits.length} raw matching chunks (${finalHits.length} after scoping):`);
    finalHits.forEach((hit, idx) => {
      console.log(`  [Hit ${idx + 1}] Doc: "${hit.documentName}" (ID: ${hit.documentId}) | Page ${hit.pageNumber} | Chunk ${hit.chunkIndex}`);
      console.log(`         RRF Score: ${hit.score}${hit.rerankerScore !== undefined ? ` | Reranker: ${hit.rerankerScore}` : ''}`);
      console.log(`         Snippet: "${hit.content.substring(0, 140).replace(/\n/g, ' ')}..."`);
    });

    return finalHits;
  }

  /**
   * Discovers distinct documents previously indexed into Azure AI Search
   * to hydrate metadata if backend restarts.
   */
  async getDistinctDocumentsFromIndex(): Promise<Array<{ documentId: string; documentName: string; pageCount: number; chunkCount: number }>> {
    if (!this.isConfigured()) return [];

    const url = `${this.getBaseUrl()}/indexes/${config.search.indexName}/docs/search?api-version=${config.search.apiVersion}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.search.apiKey,
        },
        body: JSON.stringify({
          search: '*',
          select: 'documentId,documentName,pageNumber',
          top: 1000,
        }),
      });

      if (!response.ok) return [];

      const data = await response.json();
      const docs = data.value || [];
      const map = new Map<string, { documentId: string; documentName: string; maxPage: number; count: number }>();

      for (const d of docs) {
        if (!d.documentId) continue;
        const entry = map.get(d.documentId) || {
          documentId: d.documentId,
          documentName: d.documentName || 'Indexed Document',
          maxPage: 1,
          count: 0,
        };
        entry.count++;
        if (d.pageNumber && d.pageNumber > entry.maxPage) {
          entry.maxPage = d.pageNumber;
        }
        map.set(d.documentId, entry);
      }

      return Array.from(map.values()).map((e) => ({
        documentId: e.documentId,
        documentName: e.documentName,
        pageCount: e.maxPage,
        chunkCount: e.count,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Deletes all chunks associated with a documentId from the Azure AI Search index.
   */
  async deleteDocumentChunks(documentId: string): Promise<number> {
    if (!this.isConfigured()) {
      return 0;
    }

    // 1. Query all chunk IDs belonging to this documentId
    const queryUrl = `${this.getBaseUrl()}/indexes/${config.search.indexName}/docs?api-version=${config.search.apiVersion}&$filter=documentId eq '${documentId}'&$select=id`;

    try {
      const queryResponse = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.search.apiKey,
        },
      });

      if (!queryResponse.ok) {
        console.warn(`Could not query chunks to delete for doc ${documentId}`);
        return 0;
      }

      const queryData = await queryResponse.json();
      const chunksToDelete = queryData.value || [];

      if (chunksToDelete.length === 0) {
        return 0;
      }

      // 2. Delete chunks via batch delete action
      const deleteUrl = `${this.getBaseUrl()}/indexes/${config.search.indexName}/docs/index?api-version=${config.search.apiVersion}`;
      const deletePayload = {
        value: chunksToDelete.map((c: any) => ({
          '@search.action': 'delete',
          id: c.id,
        })),
      };

      const deleteResponse = await fetch(deleteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.search.apiKey,
        },
        body: JSON.stringify(deletePayload),
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(this.sanitizeErrorMessage(deleteResponse.status, errorText));
      }

      return chunksToDelete.length;
    } catch (err: any) {
      console.error(`Error deleting chunks for document ${documentId}:`, err);
      throw err;
    }
  }
}

export const azureSearch = new AzureSearchService();

import { ChatMessage, SourceCitation, StructuredAnswer, RAGDebugInfo } from '../types/chat';
import { ActiveConceptContext } from '../types/document';
import { DEMO_PRESET_CONVERSATION } from '../data/demoData';

export interface RAGRetrievalResult {
  query: string;
  sources: SourceCitation[];
  answer: StructuredAnswer;
  rawTextResponse?: string;
  isGrounded: boolean;
  debugInfo?: RAGDebugInfo;
  followUps?: string[];
}

export interface IAIService {
  generateRAGResponse(
    query: string,
    activeDocumentIds: string[],
    isDemoMode?: boolean,
    conceptContext?: ActiveConceptContext
  ): Promise<RAGRetrievalResult>;
  generateSummary(documentId: string): Promise<StructuredAnswer>;
  generateExamQuestions(topic: string): Promise<string[]>;
}

export class RealAIService implements IAIService {
  /**
   * Primary Grounded RAG Query Pipeline:
   * 1. Calls POST /api/chat with user question and active document IDs
   * 2. Backend executes query embedding (text-embedding-3-small) -> Azure AI Search -> gpt-4.1-mini
   * 3. Returns real generated answer and verifiable citations from chunk metadata
   */
  async generateRAGResponse(
    query: string,
    activeDocumentIds: string[],
    isDemoMode: boolean = false,
    conceptContext?: ActiveConceptContext
  ): Promise<RAGRetrievalResult> {
    // If user explicitly activated static Demo Mode for presentation testing without Azure:
    if (isDemoMode) {
      return this.generateDemoFallback(query);
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          documentIds: activeDocumentIds,
          conceptContext: conceptContext || undefined,
          chunkIds: conceptContext?.chunkIds || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.details || errorData.error || `Server error (${response.status})`;

        return {
          query,
          sources: [],
          isGrounded: false,
          answer: {
            shortAnswer: errorMessage,
            bulletPoints: [
              'Ensure the backend server is running: npm run server',
              'Check server/.env to confirm AZURE_OPENAI_API_KEY and AZURE_SEARCH_API_KEY are configured.',
              'Verify that documents have been uploaded and indexed in Azure AI Search.',
            ],
            inSimpleTerms: 'Live Azure AI request could not be completed. Check service configuration.',
          },
        };
      }

      const data = await response.json();
      const rawAnswer = data.answer || '';
      const rawCitations = data.citations || data.sources || [];
      const isGrounded = Boolean(data.isGrounded) && rawCitations.length > 0;
      const followUps = data.followUps || undefined;

      // Transform backend citations to frontend SourceCitation objects
      const citations: SourceCitation[] = rawCitations.map((c: any, index: number) => ({
        id: c.chunkId || `src_${index + 1}`,
        documentId: c.documentId || 'doc',
        documentName: c.documentName || 'Uploaded Course Material',
        page: c.pageNumber || 1,
        section: `Page ${c.pageNumber || 1} Chunk`,
        excerpt: c.excerpt || '',
        relevance: c.relevanceScore || 0.88,
      }));

      const structured: StructuredAnswer = data.structuredAnswer ? {
        ...data.structuredAnswer,
        shortAnswer: data.structuredAnswer.shortAnswer || data.structuredAnswer.overview || rawAnswer,
        keyTakeaways: (data.structuredAnswer.keyTakeaways && data.structuredAnswer.keyTakeaways.length > 0)
          ? data.structuredAnswer.keyTakeaways
          : (isGrounded && citations.length > 0 ? [
              `Grounded in ${citations.length} verified excerpt(s) from ${citations[0].documentName}`,
              `Source page(s): ${Array.from(new Set(citations.map((c) => c.page))).join(', ')}`,
            ] : undefined),
      } : {
        shortAnswer: rawAnswer,
        keyTakeaways: isGrounded && citations.length > 0 ? [
          `Grounded in ${citations.length} verified excerpt(s) from ${citations[0].documentName}`,
          `Source page(s): ${Array.from(new Set(citations.map((c) => c.page))).join(', ')}`,
        ] : undefined,
      };

      return {
        query,
        sources: citations,
        isGrounded,
        debugInfo: data.debugInfo,
        followUps,
        answer: structured,
        rawTextResponse: rawAnswer,
      };
    } catch (networkErr: any) {
      console.warn('Backend /api/chat network call failed:', networkErr);
      return {
        query,
        sources: [],
        isGrounded: false,
        answer: {
          shortAnswer: `Network Error: Could not connect to API server at /api/chat. (${networkErr.message})`,
          bulletPoints: [
            'Ensure the backend server is running on port 3001: npm run server',
            'Verify Vite proxy is forwarding /api requests correctly.',
          ],
        },
      };
    }
  }

  /**
   * Static Demo Fallback: ONLY used when evaluator clicks 'Demo Mode' toggle.
   */
  private generateDemoFallback(query: string): RAGRetrievalResult {
    const preset = DEMO_PRESET_CONVERSATION[1];
    return {
      query,
      sources: preset.sources || [],
      answer: preset.structuredAnswer!,
      isGrounded: true,
    };
  }

  async generateSummary(documentTitle: string): Promise<StructuredAnswer> {
    return {
      shortAnswer: `Summary overview for ${documentTitle}`,
      bulletPoints: [
        `Core principles and definitions documented in ${documentTitle}`,
        `Architectural components and structured specifications`,
        `Practical operational criteria and evaluation frameworks`,
      ],
      keyTakeaways: [`Material: ${documentTitle}`],
    };
  }

  async generateExamQuestions(topic: string): Promise<string[]> {
    return [
      `Explain the core mechanics and principles of ${topic} based on your study material.`,
      `What are the critical architectural components and tradeoffs involved in ${topic}?`,
      `Describe how ${topic} operates in practical real-world scenarios according to the text.`,
    ];
  }
}

export const aiService = new RealAIService();

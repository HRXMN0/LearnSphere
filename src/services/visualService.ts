import { VisualType, VisualRecommendation, VisualGenerationResult } from '../types/visual';
import { SourceCitation } from '../types/chat';

export class VisualService {
  /**
   * Recommend the optimal visual format (diagram, flowchart, or mindmap) based on RAG context
   */
  static async recommendVisualType(
    question: string,
    answer: string,
    sources: SourceCitation[] = []
  ): Promise<VisualRecommendation> {
    try {
      const response = await fetch('/api/visual/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          answer,
          sources: sources.map((s) => ({
            documentId: s.documentId,
            documentName: s.documentName,
            pageNumber: s.page,
            content: s.excerpt,
          })),
        }),
      });

      if (!response.ok) {
        // Fallback default recommendation
        return {
          recommendedType: 'flowchart',
          reason: 'A structured flowchart helps sequence technical steps clearly.',
        };
      }

      return await response.json();
    } catch {
      return {
        recommendedType: 'flowchart',
        reason: 'A structured flowchart helps sequence technical steps clearly.',
      };
    }
  }

  /**
   * Request grounded visual specification from backend Azure OpenAI gpt-4.1-mini
   */
  static async generateVisual(
    question: string,
    answer: string,
    visualType: VisualType,
    sources: SourceCitation[] = []
  ): Promise<VisualGenerationResult> {
    const response = await fetch('/api/visual/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        answer,
        visualType,
        sources: sources.map((s) => ({
          documentId: s.documentId,
          documentName: s.documentName,
          pageNumber: s.page,
          content: s.excerpt,
        })),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || data.message || `Visual generation failed (${response.status})`;
      throw new Error(errorMsg);
    }

    return data as VisualGenerationResult;
  }
}

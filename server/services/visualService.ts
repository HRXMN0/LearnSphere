import { config } from '../config';
import { azureOpenAI } from './azureOpenAIService';

export type VisualType = 'flowchart' | 'mindmap' | 'diagram';

export interface VisualRecommendation {
  recommendedType: VisualType;
  reason: string;
}

export interface VisualGenerationResult {
  success: boolean;
  isGrounded: boolean;
  visual?: any;
  visualType: VisualType;
  message?: string;
  error?: string;
}

export class VisualService {
  /**
   * Evaluates the student's question, grounded answer, and source chunks
   * to recommend the most pedagogically appropriate visual format.
   */
  async recommendVisualType(
    question: string,
    answer: string,
    sources: any[] = []
  ): Promise<VisualRecommendation> {
    if (!config.openAI.isConfigured) {
      // Default heuristic recommendation if offline
      const lower = (question + ' ' + answer).toLowerCase();
      if (lower.includes('step') || lower.includes('handshake') || lower.includes('process') || lower.includes('flow') || lower.includes('algorithm')) {
        return { recommendedType: 'flowchart', reason: 'The concept describes a sequential, multi-step process.' };
      }
      if (lower.includes('overview') || lower.includes('types of') || lower.includes('hierarchy') || lower.includes('taxonomy') || lower.includes('categories')) {
        return { recommendedType: 'mindmap', reason: 'The topic presents a hierarchical concept structure ideal for mind mapping.' };
      }
      return { recommendedType: 'diagram', reason: 'The topic describes system components and their relationships.' };
    }

    const systemPrompt = `You are a learning visual design expert.
Evaluate the student's question and educational explanation to recommend the single most effective visual representation:
1. "flowchart": for chronological steps, handshakes, algorithms, state transitions, protocols, or decision workflows.
2. "mindmap": for hierarchical concepts, taxonomy, broad topic overviews, memory trees, or feature breakdowns.
3. "diagram": for architectural components, system topologies, client-server models, or spatial relationships.

Output strictly valid JSON:
{
  "recommendedType": "flowchart" | "mindmap" | "diagram",
  "reason": "One concise sentence explaining why this format best visualizes the concept."
}`;

    const promptText = `Question: "${question}"
Answer summary: "${answer.slice(0, 400)}"
Available source documents: ${sources.map(s => s.documentName).slice(0, 3).join(', ') || 'Uploaded course materials'}`;

    try {
      const data = await azureOpenAI.postRequest(config.openAI.chatDeployment, 'chat/completions', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptText },
        ],
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(data.choices[0].message.content);
      const validTypes: VisualType[] = ['flowchart', 'mindmap', 'diagram'];
      const recommendedType: VisualType = validTypes.includes(parsed.recommendedType) ? parsed.recommendedType : 'flowchart';

      return {
        recommendedType,
        reason: parsed.reason || 'This format best clarifies the key relationships in your study material.',
      };
    } catch (e) {
      console.warn('[VisualService] Recommend failed, falling back to heuristic:', e);
      return {
        recommendedType: 'flowchart',
        reason: 'Recommended based on sequential concept analysis.',
      };
    }
  }

  /**
   * Generates a grounded, structured visual specification (flowchart, mindmap, diagram)
   * strictly derived from the retrieved RAG source chunks and verified answer.
   */
  async generateVisualSpec(
    question: string,
    answer: string,
    visualType: VisualType,
    sources: any[] = []
  ): Promise<VisualGenerationResult> {
    if (!config.openAI.isConfigured) {
      throw new Error('Azure OpenAI is not configured in server/.env.');
    }

    // PART 4: Ground Visuals in RAG — If no sources exist, refuse to fabricate
    if (!sources || sources.length === 0) {
      return {
        success: false,
        isGrounded: false,
        visualType,
        message: "I don't have enough information in your selected learning materials to generate a reliable visual for this topic.",
      };
    }

    const contextSnippets = sources
      .map((s, idx) => `[Source ${idx + 1} | ${s.documentName}, Page ${s.page || s.pageNumber || 1}]:\n${s.excerpt || s.content || ''}`)
      .join('\n\n');

    let schemaPrompt = '';
    if (visualType === 'flowchart') {
      schemaPrompt = `You must generate a FLOWCHART specification strictly matching:
{
  "type": "flowchart",
  "title": "Concise Descriptive Title",
  "description": "Short explanation of the flow",
  "nodes": [
    { "id": "1", "label": "Concise step label", "type": "start" | "process" | "decision" | "end", "detail": "Optional technical detail" }
  ],
  "edges": [
    { "from": "1", "to": "2", "label": "Transition or packet/signal label" }
  ],
  "groundingSource": { "documentName": "${sources[0]?.documentName || 'Course Material'}", "page": ${sources[0]?.page || sources[0]?.pageNumber || 1} }
}`;
    } else if (visualType === 'mindmap') {
      schemaPrompt = `You must generate a MIND MAP specification strictly matching:
{
  "type": "mindmap",
  "title": "Concise Descriptive Title",
  "root": "Core Concept Name",
  "branches": [
    {
      "label": "Primary Branch Label",
      "description": "Brief note",
      "children": [
        { "label": "Sub-concept", "description": "Specific detail from source text" }
      ]
    }
  ],
  "groundingSource": { "documentName": "${sources[0]?.documentName || 'Course Material'}", "page": ${sources[0]?.page || sources[0]?.pageNumber || 1} }
}`;
    } else {
      schemaPrompt = `You must generate a SYSTEM / COMPONENT DIAGRAM specification strictly matching:
{
  "type": "diagram",
  "title": "Concise Descriptive Title",
  "description": "Brief overview of architecture or components",
  "components": [
    { "id": "c1", "label": "Component / Entity Name", "role": "Specific role or responsibility", "group": "Layer or System grouping" }
  ],
  "connections": [
    { "from": "c1", "to": "c2", "relationship": "Interaction or data flow" }
  ],
  "groundingSource": { "documentName": "${sources[0]?.documentName || 'Course Material'}", "page": ${sources[0]?.page || sources[0]?.pageNumber || 1} }
}`;
    }

    const systemPrompt = `You are an expert technical visual generator for university-level learning.
Generate a structured visual specification of type "${visualType}".
CRITICAL RULES:
1. Every node, connection, step, and label MUST be strictly grounded in the provided Source Material and Grounded Answer.
2. If the sources DO NOT contain enough specific details to produce an authentic visual, return:
   { "insufficientContext": true, "message": "I don't have enough information in your selected learning materials to generate a reliable visual for this topic." }
3. Output strictly valid JSON.
4. Keep labels clear, concise, and academically precise.

${schemaPrompt}`;

    const userContent = `STUDENT QUESTION: "${question}"
GROUNDED ANSWER: "${answer}"

VERIFIED SOURCE MATERIAL:
${contextSnippets}`;

    console.log(`[VisualService] Generating ${visualType} with ${sources.length} sources...`);

    const response = await azureOpenAI.postRequest(config.openAI.chatDeployment, 'chat/completions', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const rawJson = response.choices[0]?.message?.content;
    try {
      const parsed = JSON.parse(rawJson);

      if (parsed.insufficientContext) {
        return {
          success: false,
          isGrounded: false,
          visualType,
          message: parsed.message || "I don't have enough information in your selected learning materials to generate a reliable visual for this topic.",
        };
      }

      // Ensure root type matches
      parsed.type = visualType;

      return {
        success: true,
        isGrounded: true,
        visualType,
        visual: parsed,
      };
    } catch (e: any) {
      console.error('[VisualService Error] Failed to parse generated visual JSON:', e);
      throw new Error(`Visual generation failed to produce valid specification: ${e.message}`);
    }
  }
}

export const visualService = new VisualService();

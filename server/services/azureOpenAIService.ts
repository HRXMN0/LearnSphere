import { config } from '../config';

export interface StructuredAnswerSectionItem {
  heading: string;
  type: 'paragraph' | 'steps' | 'bullets' | 'table' | 'callout' | 'quiz_interactive';
  content?: string;
  items?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  calloutType?: 'info' | 'analogy' | 'warning' | 'remember';
  quizQuestions?: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswerIndex?: number;
    explanation?: string;
  }>;
}

export interface StructuredAnswerPayload {
  answerType: 'concept_explanation' | 'step_by_step' | 'comparison' | 'definition' | 'summary' | 'example' | 'quiz' | 'application' | 'process_mechanism' | 'general_question';
  title: string;
  overview: string;
  shortAnswer: string;
  isGrounded: boolean;
  sections: StructuredAnswerSectionItem[];
  keyDifferences?: {
    headerA: string;
    headerB: string;
    rows: Array<{ feature: string; colA: string; colB: string }>;
  };
  stepByStep?: string[];
  bulletPoints?: string[];
  inSimpleTerms?: string;
  keyTakeaways?: string[];
  recommendedVisual?: {
    type: 'flowchart' | 'mindmap' | 'diagram';
    reason: string;
  };
}

export function formatStructuredAnswerToMarkdown(payload: StructuredAnswerPayload): string {
  if (!payload.isGrounded) {
    return payload.shortAnswer || "I couldn't find enough information about this topic in your selected learning materials.";
  }

  const lines: string[] = [];
  if (payload.title) {
    lines.push(`## ${payload.title}\n`);
  }
  if (payload.overview) {
    lines.push(`${payload.overview}\n`);
  }

  if (payload.sections && payload.sections.length > 0) {
    for (const sec of payload.sections) {
      lines.push(`### ${sec.heading}`);
      if (sec.type === 'paragraph' && sec.content) {
        lines.push(sec.content);
      } else if (sec.type === 'steps' && sec.items) {
        sec.items.forEach((item, idx) => {
          lines.push(`${idx + 1}. ${item}`);
        });
      } else if (sec.type === 'bullets' && sec.items) {
        sec.items.forEach((item) => {
          lines.push(`• ${item}`);
        });
      } else if (sec.type === 'callout' && sec.content) {
        lines.push(`> **${sec.heading}**: ${sec.content}`);
      } else if (sec.type === 'table' && sec.table) {
        lines.push(`| ${sec.table.headers.join(' | ')} |`);
        lines.push(`| ${sec.table.headers.map(() => '---').join(' | ')} |`);
        sec.table.rows.forEach((r) => lines.push(`| ${r.join(' | ')} |`));
      } else if (sec.type === 'quiz_interactive' && sec.quizQuestions) {
        sec.quizQuestions.forEach((q, qIdx) => {
          lines.push(`**Question ${qIdx + 1}: ${q.question}**`);
          q.options.forEach((opt) => lines.push(`- ${opt}`));
          lines.push('');
        });
      } else if (sec.content) {
        lines.push(sec.content);
      }
      lines.push('');
    }
  }

  if (payload.keyTakeaways && payload.keyTakeaways.length > 0) {
    lines.push(`### Key Takeaways`);
    payload.keyTakeaways.forEach((t) => lines.push(`• ${t}`));
    lines.push('');
  }

  return lines.join('\n').trim();
}

export class AzureOpenAIService {
  public isConfigured(): boolean {
    return config.openAI.isConfigured;
  }

  /**
   * Resolves the base URL for Azure OpenAI v1 endpoints.
   * Microsoft Foundry project endpoints often contain /api/projects/proj-default in pathname,
   * while the OpenAI v1 REST API is hosted at the root origin (https://<resource>.services.ai.azure.com)
   * or standard Azure OpenAI domain.
   */
  private getV1BaseUrl(): string {
    const raw = config.openAI.endpoint.replace(/\/+$/, '');
    try {
      const parsed = new URL(raw);
      return parsed.origin;
    } catch {
      return raw;
    }
  }

  /**
   * Executes Azure OpenAI v1 REST request:
   * URL: {BASE_URL}/openai/v1/{subPath} (NO dated api-version query parameter)
   * Header: 'api-key'
   * Body: { model: deployment, ...payload }
   */
  public async postRequest(deployment: string, subPath: string, payload: any): Promise<any> {
    const v1Base = this.getV1BaseUrl();
    const v1Url = `${v1Base}/openai/v1/${subPath}`;
    const v1Payload = { ...payload, model: deployment };

    if (subPath === 'chat/completions') {
      // 1. Convert max_tokens to max_completion_tokens (required by gpt-5*, sol, o1*, o3* and modern OpenAI v1)
      if (v1Payload.max_tokens !== undefined) {
        if (v1Payload.max_completion_tokens === undefined) {
          v1Payload.max_completion_tokens = v1Payload.max_tokens;
        }
        delete v1Payload.max_tokens;
      }

      // 2. Certain models (e.g. gpt-5*, sol, o1, o3) only support default temperature (1)
      const isReasoningOrGpt5 = /gpt-5|sol|o1|o3/i.test(deployment);
      if (isReasoningOrGpt5) {
        delete v1Payload.temperature;
      }
    }

    let response = await fetch(v1Url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.openAI.apiKey,
      },
      body: JSON.stringify(v1Payload),
    });

    // Resilient fallback if Azure OpenAI returns 400 for parameter compatibility
    if (!response.ok && response.status === 400) {
      const errText = await response.text();
      let shouldRetry = false;
      if (errText.includes('max_tokens') && v1Payload.max_tokens !== undefined) {
        v1Payload.max_completion_tokens = v1Payload.max_tokens;
        delete v1Payload.max_tokens;
        shouldRetry = true;
      }
      if (errText.includes('temperature') && v1Payload.temperature !== undefined) {
        delete v1Payload.temperature;
        shouldRetry = true;
      }
      if (errText.includes('reasoning_effort') && v1Payload.reasoning_effort !== undefined) {
        delete v1Payload.reasoning_effort;
        shouldRetry = true;
      }
      if (shouldRetry) {
        response = await fetch(v1Url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': config.openAI.apiKey,
          },
          body: JSON.stringify(v1Payload),
        });
      }
      if (!response.ok) {
        const finalErr = shouldRetry ? await response.text() : errText;
        throw new Error(this.sanitizeErrorMessage(response.status, finalErr));
      }
      return await response.json();
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(this.sanitizeErrorMessage(response.status, errText));
    }

    return await response.json();
  }

  private sanitizeErrorMessage(status: number, rawText: string): string {
    // Prevent logging or returning any API keys or internal tokens
    try {
      const parsed = JSON.parse(rawText);
      const msg = parsed.error?.message || parsed.message || rawText;
      if (status === 401 || status === 403) {
        return `Azure OpenAI Authentication failed (${status}): Invalid or unauthorized API key. Check AZURE_OPENAI_API_KEY in server/.env.`;
      }
      if (status === 404) {
        return `Azure OpenAI Resource or Deployment not found (${status}): Verify deployment name in Azure Foundry/OpenAI portal.`;
      }
      if (status === 429) {
        return `Azure OpenAI Rate limit or Quota exceeded (${status}): Retry in a few seconds.`;
      }
      return `Azure OpenAI API Error (${status}): ${msg}`;
    } catch {
      return `Azure OpenAI API Error (${status}): ${rawText.substring(0, 150)}`;
    }
  }

  /**
   * Generates real 1536-dimensional vector embedding for a single text chunk
   * using deployment text-embedding-3-small via current Azure OpenAI API.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isConfigured()) {
      throw new Error(
        'Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in server/.env.'
      );
    }

    const cleanInput = text.replace(/\n+/g, ' ').trim();
    const data = await this.postRequest(config.openAI.embeddingDeployment, 'embeddings', {
      input: cleanInput,
    });

    return data.data[0].embedding;
  }

  /**
   * Generates batch embeddings for an array of texts.
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured()) {
      throw new Error('Azure OpenAI is not configured. Set server/.env credentials.');
    }

    const cleanInputs = texts.map((t) => t.replace(/\n+/g, ' ').trim());
    const data = await this.postRequest(config.openAI.embeddingDeployment, 'embeddings', {
      input: cleanInputs,
    });

    return data.data.map((item: any) => item.embedding);
  }

  /**
   * Calls Azure OpenAI Chat Completions for grounded RAG generation using gpt-4.1-mini.
   */
  async generateChatResponse(
    userQuestion: string,
    retrievedContext: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in server/.env.'
      );
    }

    const systemPrompt = `You are an elite academic tutor and multimodal learning assistant.
Answer the user's question using only the supplied retrieved course context.

MANDATORY GROUNDING RULES:
1. Answer using ONLY the facts and explanations present in the retrieved course context.
2. If the context does not contain enough information to answer reliably, say:
   "I couldn't find enough information about this topic in your selected learning materials."
3. Do not invent facts, sources, page numbers, or citations.
4. Clearly explain the concepts accurately and helpfully.
5. Provide a direct Short Answer, detailed explanation or comparison table if appropriate, and an intuitive "In Simple Terms" analogy where helpful.`;

    const userPrompt = `Retrieved Context from Student's Uploaded Materials:
=========================================================
${retrievedContext}
=========================================================

Student's Question: "${userQuestion}"

Please answer using ONLY the retrieved context above:`;

    const data = await this.postRequest(config.openAI.chatDeployment, 'chat/completions', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2, // Low temperature for grounded precision
      max_tokens: 1200,
    });

    return data.choices[0].message.content;
  }

  /**
   * Generates a pedagogical, structured answer adhering to academic tutor principles.
   * Classifies question intent, generates scannable sections, formats tables/steps/callouts,
   * and strictly prevents unwanted quizzes unless explicitly requested.
   */
  async generateGroundedStructuredAnswer(
    userQuestion: string,
    retrievedContext: string,
    conceptContext?: {
      conceptTitle?: string;
      conceptDescription?: string;
      unitTitle?: string;
      sectionTitle?: string;
      pageStart?: number;
      pageEnd?: number;
      keywords?: string[];
    }
  ): Promise<StructuredAnswerPayload> {
    if (!this.isConfigured()) {
      throw new Error(
        'Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in server/.env.'
      );
    }

    const systemPrompt = `You are an elite university professor and multimodal academic tutor.
Your mission is to synthesize the retrieved course excerpts into an exceptionally clear, structured, readable, and pedagogical response for a university student.

=======================================================
STRICT TUTORING & GROUNDING PRINCIPLES:
=======================================================
1. GROUNDED IN TRUTH:
   - Base all claims strictly on the provided course material.
   - If the retrieved excerpts do not contain sufficient evidence to answer the question, set "isGrounded": false, and write in "shortAnswer":
     "I couldn't find enough information about this topic in your selected learning materials."
   - Do NOT invent or assume facts beyond the provided context.

2. ELIMINATE THE "WALL OF TEXT":
   - NEVER output a giant amorphous block of text.
   - Organize everything into short, bite-sized, scannable sections with clear headings, short paragraphs (1-3 sentences), numbered steps, bullet points, comparison tables, and highlight callouts.

3. CRITICAL ANTI-QUIZ RULE (DO NOT VIOLATE):
   - Retrieved slides or textbooks frequently contain multiple-choice questions or practice questions.
   - UNDER NO CIRCUMSTANCES should you output a quiz, test questions, or multiple-choice questions UNLESS the student explicitly asked for a quiz in their prompt (e.g. "quiz me", "create a quiz", "practice quiz", "test my knowledge").
   - If the student asks an explanatory question like "Explain Ethernet", "What is CSMA/CD?", or "How does TCP work?", you MUST provide a structured conceptual explanation, NOT a quiz!

4. CLASSIFY QUESTION INTENT & APPLY THE EXACT PEDAGOGICAL TEMPLATE:
   Choose the "answerType" matching the user's intent:

   A. "concept_explanation" (Questions like "What is flow control?", "Explain Ethernet", "Explain TCP"):
      - Section: "What is it?" (type: "paragraph", clear 1-3 sentence explanation)
      - Section: "Why is it needed?" (type: "paragraph", problem/purpose it addresses)
      - Section: "How does it work?" (type: "steps" or "paragraph", mechanism in logical sequence)
      - Section: "Simple Example" (type: "paragraph", concrete example using terminology from material)
      - Section: "Key Points" (type: "bullets", 3-5 concise bullets)
      - Section: "Remember This" (type: "callout", calloutType: "remember", memorable takeaway)

   B. "step_by_step" or "process_mechanism" (Questions like "Explain step by step", "How does CSMA/CD work?", algorithms):
      - Section: "Sequence Breakdown" (type: "steps", items: ["Step 1 — ...", "Step 2 — ...", ...])
      - Section: "In Simple Terms" (type: "callout", calloutType: "analogy", plain-language recap)
      - Section: "Key Takeaway" (type: "bullets", 1-2 concise conclusions)

   C. "comparison" (Questions like "TCP vs UDP", "CSMA/CD vs CSMA/CA", "Compare two concepts"):
      - Section: "Direct Comparison" (type: "table", table: { headers: ["Feature", "Concept A", "Concept B"], rows: [["Purpose", "...", "..."], ["Mechanism", "...", "..."], ["Typical Use", "...", "..."]] })
      - Section: "Main Differences" (type: "paragraph", 2-4 sentences explaining the core distinction)
      - Section: "Easy Way to Remember" (type: "callout", calloutType: "remember", short memory aid)

   D. "definition" (Questions like "What is CSMA/CD?", "Define flow control"):
      - Section: "Definition" (type: "paragraph", concise, exact academic definition)
      - Section: "In Simple Words" (type: "callout", calloutType: "analogy", student-friendly analogy)
      - Section: "How it Works" (type: "steps" or "bullets", key mechanics)
      - Section: "Key Takeaway" (type: "bullets", 1 high-yield sentence)

   E. "summary" (Questions like "Summarize this material", "Summarize this section"):
      - Section: "Overview" (type: "paragraph", short summary)
      - Section: "Main Concepts" (type: "steps", items: ["1. ...", "2. ..."])
      - Section: "Important Details" (type: "bullets", bulleted insights)
      - Section: "Exam-Focused Points" (type: "bullets", high-yield revision facts)
      - Section: "One-Minute Revision" (type: "callout", calloutType: "remember")

   F. "example" or "application" (Questions like "Give me a real-world example", "How is it used"):
      - Section: "Concept" (type: "paragraph")
      - Section: "Real-World Example" (type: "paragraph")
      - Section: "How the Concept Appears in this Example" (type: "steps" or "bullets")
      - Section: "Why it Matters" (type: "paragraph")

   G. "quiz" (ONLY when user explicitly requested a quiz):
      - Section: "Interactive Practice Quiz" (type: "quiz_interactive", quizQuestions: [
          { "id": "q1", "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswerIndex": 0, "explanation": "..." }
        ])

5. VISUAL RECOMMENDATION:
   - If the material describes a process / sequence -> recommendedVisual: { "type": "flowchart", "reason": "A sequential flowchart best illustrates these protocol steps." }
   - If the material describes components / system relationships -> recommendedVisual: { "type": "diagram", "reason": "A structural diagram maps out these network components clearly." }
   - If the material covers an overview / hierarchical concepts -> recommendedVisual: { "type": "mindmap", "reason": "A hierarchical mind map provides a fast conceptual overview." }

=======================================================
OUTPUT FORMAT:
=======================================================
Return valid JSON matching this schema:
{
  "answerType": "concept_explanation" | "step_by_step" | "comparison" | "definition" | "summary" | "example" | "quiz" | "application" | "process_mechanism" | "general_question",
  "title": "Clean Academic Title",
  "overview": "Concise 1-2 sentence overview for voice listening",
  "shortAnswer": "Direct concise answer",
  "isGrounded": true,
  "sections": [
    {
      "heading": "...",
      "type": "paragraph" | "steps" | "bullets" | "table" | "callout" | "quiz_interactive",
      "content": "...",
      "items": ["..."],
      "table": { "headers": ["Feature", "..."], "rows": [["...", "..."]] },
      "calloutType": "info" | "analogy" | "warning" | "remember",
      "quizQuestions": [{ "id": "q1", "question": "...", "options": ["..."], "correctAnswerIndex": 0, "explanation": "..." }]
    }
  ],
  "keyDifferences": { "headerA": "...", "headerB": "...", "rows": [{ "feature": "...", "colA": "...", "colB": "..." }] },
  "stepByStep": ["Step 1...", "Step 2..."],
  "bulletPoints": ["Point 1...", "Point 2..."],
  "inSimpleTerms": "Analogous plain-English summary",
  "keyTakeaways": ["Key takeaway 1", "Key takeaway 2"],
  "recommendedVisual": { "type": "flowchart", "reason": "..." }
}`;

    let conceptScopeNotice = '';
    if (conceptContext && conceptContext.conceptTitle) {
      conceptScopeNotice = `\nActive Concept Scope Selected by Student:
- Concept: "${conceptContext.conceptTitle}"
${conceptContext.unitTitle ? `- Unit: "${conceptContext.unitTitle}"\n` : ''}${conceptContext.sectionTitle ? `- Section: "${conceptContext.sectionTitle}"\n` : ''}${conceptContext.conceptDescription ? `- Scope: ${conceptContext.conceptDescription}\n` : ''}${conceptContext.pageStart ? `- Source Pages: pp. ${conceptContext.pageStart}–${conceptContext.pageEnd || conceptContext.pageStart}\n` : ''}${conceptContext.keywords && conceptContext.keywords.length > 0 ? `- Keywords: ${conceptContext.keywords.join(', ')}\n` : ''}
Focus the explanation specifically around this concept using the retrieved chunks from this concept. You may simplify, provide intuitive analogies, and explain real-world relevance, but keep all facts bounded strictly to the uploaded material.\n`;
    }

    const userPrompt = `Retrieved Context from Student's Uploaded Materials:
=========================================================
${retrievedContext}
=========================================================
${conceptScopeNotice}
Student's Question: "${userQuestion}"

Synthesize a structured pedagogical answer strictly from the context above:`;

    try {
      const data = await this.postRequest(config.openAI.chatDeployment, 'chat/completions', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1800,
        response_format: { type: 'json_object' },
      });

      const rawJson = data.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawJson);

      // Validate and sanitize parsed payload
      return {
        answerType: parsed.answerType || 'concept_explanation',
        title: parsed.title || 'Academic Explanation',
        overview: parsed.overview || parsed.shortAnswer || '',
        shortAnswer: parsed.shortAnswer || parsed.overview || '',
        isGrounded: parsed.isGrounded !== false,
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        keyDifferences: parsed.keyDifferences || undefined,
        stepByStep: Array.isArray(parsed.stepByStep) ? parsed.stepByStep : undefined,
        bulletPoints: Array.isArray(parsed.bulletPoints) ? parsed.bulletPoints : undefined,
        inSimpleTerms: parsed.inSimpleTerms || undefined,
        keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : undefined,
        recommendedVisual: parsed.recommendedVisual || undefined,
      };
    } catch (err: any) {
      console.error('[Structured Answer Generation Error]', err);
      // Fallback to basic answer format
      return {
        answerType: 'general_question',
        title: 'Response',
        overview: 'Could not generate structured sections.',
        shortAnswer: "I couldn't find enough information about this topic in your selected learning materials.",
        isGrounded: false,
        sections: [
          {
            heading: 'Grounding Scope Notice',
            type: 'callout',
            calloutType: 'warning',
            content: "I couldn't find enough verified information about this topic in your selected learning materials. To protect accuracy, grounded answers are limited to uploaded course materials.",
          },
        ],
      };
    }
  }


  /**
   * Robust JSON extractor and parser that handles:
   * 1. Direct valid JSON strings
   * 2. Markdown fenced code blocks (```json ... ``` or ``` ... ```)
   * 3. Extra surrounding commentary / text around the JSON object
   */
  private parseVisionJsonResponse(content: string | null | undefined): any {
    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new Error('Azure OpenAI returned an empty response for the visual analysis.');
    }

    const trimmed = content.trim();

    // 1. Direct JSON parse
    try {
      return JSON.parse(trimmed);
    } catch {
      // Continue to code fence extraction
    }

    // 2. Extract from markdown code fences: ```json ... ``` or ``` ... ```
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch && fenceMatch[1]) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        // Continue to outermost bracket extraction
      }
    }

    // 3. Extract outermost JSON object { ... }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = trimmed.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // Fall through
      }
    }

    throw new Error('Azure OpenAI returned malformed JSON for the visual analysis.');
  }

  /**
   * Real Multimodal Vision Analysis: sends user-provided image to Azure OpenAI vision deployment.
   */
  async analyzeVisionImage(
    imageBase64: string,
    mimeType: string,
    userPrompt: string
  ): Promise<{
    title: string;
    whatISee: string;
    keyConcepts: string[];
    stepByStep: Array<{ stepNumber: number; title: string; description: string; senderReceiver?: string }>;
    importantLabels: Array<{ tag: string; description: string }>;
    detailedExplanation: string;
  }> {
    if (!this.isConfigured()) {
      throw new Error(
        'Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in server/.env.'
      );
    }

    const systemPrompt = `You are an expert multimodal visual and technical analyst.
Analyze the user's uploaded image, diagram, architectural chart, circuit, note, or photo with extreme fidelity.
CRITICAL INSTRUCTIONS:
1. Every observation in your response MUST come directly from what is visible in THIS specific image. Never hallucinate or reuse text from a different diagram or topic.
2. If the image depicts a step-by-step sequential process (e.g. handshake, protocol exchange, algorithm workflow), enumerate the chronological steps in "stepByStep".
3. If the image does NOT depict a sequential process (e.g. static architecture, photo, circuit schematic, single diagram), return an empty array [] for "stepByStep". Do not force steps where none exist.
4. Extract all actual text, acronyms, signal names, node labels, or component tags visible in the image into "importantLabels".
5. Provide a rigorous, educational explanation in "detailedExplanation" explaining the principles shown.

Return a structured JSON object strictly matching this schema:
{
  "title": "Precise, descriptive title for this specific visual",
  "whatISee": "Comprehensive, objective visual summary of all elements, layout, components, and connections visible in this image",
  "keyConcepts": ["Concept 1", "Concept 2", "Concept 3"],
  "stepByStep": [
    { "stepNumber": 1, "title": "Step title", "description": "Technical description of what occurs", "senderReceiver": "Optional source/destination" }
  ],
  "importantLabels": [
    { "tag": "Exact label name from image", "description": "Function or role in this visual" }
  ],
  "detailedExplanation": "Thorough educational explanation of the concepts depicted"
}
Output strictly valid JSON.`;

    const imageUrl = `data:${mimeType};base64,${imageBase64}`;
    const isReasoning = /gpt-5|sol|o1|o3/i.test(config.openAI.visionDeployment);
    const payload: any = {
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt || 'Analyze this technical diagram or image in detail.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    };

    if (isReasoning) {
      payload.reasoning_effort = 'low';
    } else {
      payload.temperature = 0.2;
    }

    const data = await this.postRequest(config.openAI.visionDeployment, 'chat/completions', payload);

    const firstChoice = data.choices && data.choices[0];
    if (!firstChoice) {
      throw new Error('Azure OpenAI returned no completion choices for the visual analysis.');
    }

    if (firstChoice.finish_reason === 'length' && (!firstChoice.message?.content || !firstChoice.message.content.trim())) {
      throw new Error('Azure OpenAI token limit reached before visual analysis completed.');
    }

    const rawJson = firstChoice.message?.content;
    const parsed = this.parseVisionJsonResponse(rawJson);

    return {
      title: parsed.title || 'Analyzed Image',
      whatISee: parsed.whatISee || 'Visual analysis complete.',
      keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
      stepByStep: Array.isArray(parsed.stepByStep) ? parsed.stepByStep : [],
      importantLabels: Array.isArray(parsed.importantLabels) ? parsed.importantLabels : [],
      detailedExplanation: parsed.detailedExplanation || parsed.whatISee || '',
    };
  }

  /**
   * Real Multimodal Q&A: Answers questions grounded in the user's specific uploaded image.
   */
  async askQuestionAboutImage(
    imageBase64: string,
    mimeType: string,
    userQuestion: string,
    priorContext?: string
  ): Promise<{ answer: string }> {
    if (!this.isConfigured()) {
      throw new Error(
        'Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in server/.env.'
      );
    }

    const systemPrompt = `You are an expert multimodal visual tutor and technical educator.
The user is asking a specific question about the attached image.
Analyze the provided image with precision. Answer the user's question directly, clearly, and authoritatively based on what is visible in the visual.
${priorContext ? `Context from earlier visual analysis: ${priorContext}` : ''}
Ground your answer explicitly in the visual evidence (e.g. labels, connections, values, arrows, text blocks).
If a detail cannot be determined from the image, state that candidly.`;

    const imageUrl = `data:${mimeType};base64,${imageBase64}`;
    const isReasoning = /gpt-5|sol|o1|o3/i.test(config.openAI.visionDeployment);
    const payload: any = {
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userQuestion },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 2500,
    };

    if (isReasoning) {
      payload.reasoning_effort = 'low';
    } else {
      payload.temperature = 0.3;
    }

    const data = await this.postRequest(config.openAI.visionDeployment, 'chat/completions', payload);

    const answer = data.choices[0]?.message?.content || 'No response generated.';
    return { answer };
  }

  /**
   * Generates dynamic quiz questions grounded in actual retrieved document text.
   */
  async generateQuiz(
    retrievedDocumentContext: string,
    topic: string,
    count: number = 5
  ): Promise<any[]> {
    if (!this.isConfigured()) {
      throw new Error(
        'Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in server/.env.'
      );
    }

    const systemPrompt = `You are an academic assessment generator.
Create ${count} multiple choice questions (MCQ) grounded EXCLUSIVELY in the provided course context.
Return a JSON object containing a "questions" array with this schema:
{
  "questions": [
    {
      "id": "q1",
      "questionNumber": 1,
      "prompt": "Question text...",
      "type": "MCQ",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "explanation": "Detailed explanation grounded in the text...",
      "sourceReference": {
        "topic": "${topic}"
      }
    }
  ]
}
Output strictly valid JSON.`;

    const userPrompt = `Retrieved Course Content:
=========================================================
${retrievedDocumentContext}
=========================================================
Topic: ${topic}
Number of questions: ${count}
Generate questions strictly from this material:`;

    const data = await this.postRequest(config.openAI.chatDeployment, 'chat/completions', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(data.choices[0].message.content);
    return Array.isArray(parsed) ? parsed : parsed.questions || [];
  }

  /**
   * General-purpose structured JSON completion with gpt-4.1-mini.
   */
  async generateCustomJson(systemPrompt: string, userPrompt: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Azure OpenAI is not configured.');
    }

    const data = await this.postRequest(config.openAI.chatDeployment, 'chat/completions', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(data.choices[0].message.content);
  }

  async generateCompletion(messages: Array<{ role: string; content: string }>): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Azure OpenAI is not configured.');
    }

    const data = await this.postRequest(config.openAI.chatDeployment, 'chat/completions', {
      messages,
      temperature: 0.3,
    });

    return data.choices[0].message.content || '';
  }
}

export const azureOpenAI = new AzureOpenAIService();

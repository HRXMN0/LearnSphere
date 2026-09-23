import { ragPipeline } from './ragPipeline';
import { azureOpenAI } from './azureOpenAIService';
import { speechService } from './speechService';
import { pdfExportService } from './pdfExportService';
import {
  AIClassSession,
  ClassState,
  LessonStep,
  StudyNote,
  TeachingBoardState,
  UnderstandingCheck,
} from '../../src/types/aiClass';
import { ConversationTurn, SessionSummary } from '../../src/types/studySession';

export class AIClassService {
  private classes: Map<string, AIClassSession> = new Map();

  async createClass(
    documentId: string,
    options?: { unitId?: string; sectionId?: string; conceptIds?: string[] }
  ): Promise<AIClassSession> {
    const docs = await ragPipeline.getDocuments();
    const doc = docs.find((d) => d.id === documentId) || docs[0];

    const classId = `cls_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const docName = doc ? doc.name : 'Selected Learning Material';

    // Retrieve canonical Course Topic Map to plan curriculum
    let lessonSteps: Array<{
      id: string;
      topic: string;
      concept: string;
      chunkIds?: string[];
      pageStart?: number;
      pageEnd?: number;
    }> = [];

    try {
      const topicMap = await ragPipeline.getCourseTopicMap(doc ? doc.id : documentId);
      if (topicMap && topicMap.nodes.length > 0) {
        let concepts = topicMap.nodes.filter((n) => n.level === 'concept');

        // Scoping: support selecting specific section, unit, or conceptIds
        if (options?.conceptIds && options.conceptIds.length > 0) {
          concepts = concepts.filter((c) => options.conceptIds!.includes(c.id));
        } else if (options?.sectionId) {
          concepts = concepts.filter((c) => c.parentId === options.sectionId);
        } else if (options?.unitId) {
          const unitSections = topicMap.nodes
            .filter((n) => n.parentId === options.unitId)
            .map((s) => s.id);
          concepts = concepts.filter((c) => c.parentId && unitSections.includes(c.parentId));
        }

        // Scope to 3-6 concepts per class session to prevent an overwhelming session
        const scopedConcepts = concepts.slice(0, 6);

        lessonSteps = scopedConcepts.map((c) => {
          const parent = topicMap.nodes.find((n) => n.id === c.parentId);
          return {
            id: c.id,
            topic: parent ? parent.title : topicMap.courseTitle,
            concept: c.title,
            chunkIds: c.chunkIds,
            pageStart: c.pageStart,
            pageEnd: c.pageEnd,
          };
        });
      }
    } catch (e) {
      console.warn('[AIClass] Could not load CourseTopicMap for curriculum, falling back:', e);
    }

    if (lessonSteps.length === 0) {
      lessonSteps = [
        { id: 'step_1', topic: docName.replace('.pdf', ''), concept: 'Core Definition & Purpose' },
        { id: 'step_2', topic: docName.replace('.pdf', ''), concept: 'Why it is needed in network communication' },
        { id: 'step_3', topic: docName.replace('.pdf', ''), concept: 'Step-by-step mechanism and protocol flow' },
        { id: 'step_4', topic: docName.replace('.pdf', ''), concept: 'Real-world example and buffer management' },
        { id: 'step_5', topic: docName.replace('.pdf', ''), concept: 'Understanding check and concept review' },
      ];
    }

    const initialBoard: TeachingBoardState = {
      title: docName.replace('.pdf', ''),
      subtitle: 'Private 1-to-1 Interactive Lecture',
      blocks: [
        {
          type: 'heading',
          text: `Welcome to your private class on ${docName.replace('.pdf', '')}`,
        },
        {
          type: 'callout',
          title: 'Class Format',
          content:
            'I will proactively lecture through each key concept, writing notes on this board and speaking through each mechanism. You can hit [ 🎤 Interrupt / Ask ] at any moment to pause and ask questions!',
        },
        {
          type: 'bullets',
          items: lessonSteps.map((s, i) => `Part ${i + 1}: ${s.concept}`),
        },
      ],
      sources: [],
    };

    const session: AIClassSession = {
      classId,
      documentId: doc ? doc.id : documentId,
      documentName: docName,
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      state: 'CLASS_READY',
      currentTopic: lessonSteps[0]?.topic || 'Introduction',
      currentConcept: lessonSteps[0]?.concept || 'Overview',
      teachingBoard: initialBoard,
      notes: [],
      turns: [],
      topicsCovered: [],
      lessonPlan: {
        overview: `Comprehensive masterclass on ${docName}`,
        steps: lessonSteps,
        currentStepIndex: 0,
      },
    };

    this.classes.set(classId, session);
    return session;
  }

  getClass(classId: string): AIClassSession | undefined {
    return this.classes.get(classId);
  }

  /**
   * Fast, lightweight session activation: returns immediately (<10ms) so the classroom
   * renders without blocking on RAG, LLM, or TTS.
   */
  async startClass(classId: string): Promise<{ session: AIClassSession; ready: boolean }> {
    const session = this.classes.get(classId);
    if (!session) throw new Error('Class not found');

    session.state = 'STARTING';
    return { session, ready: true };
  }

  /**
   * Executes a specific step (or current step)
   */
  async executeStep(
    classId: string,
    stepIndex?: number
  ): Promise<{ session: AIClassSession; audioUrl?: string; wasPrefetched?: boolean }> {
    const session = this.classes.get(classId);
    if (!session) throw new Error('Class not found');
    if (!session.lessonPlan) throw new Error('No lesson plan found');

    const targetIdx = stepIndex !== undefined ? stepIndex : session.lessonPlan.currentStepIndex;
    session.state = 'TEACHING';
    return this.executeTeachingStep(session, targetIdx);
  }

  /**
   * Advances the teacher to the next concept in the lesson plan
   */
  async nextStep(
    classId: string
  ): Promise<{ session: AIClassSession; audioUrl?: string; wasPrefetched?: boolean }> {
    const session = this.classes.get(classId);
    if (!session) throw new Error('Class not found');
    if (!session.lessonPlan) throw new Error('No lesson plan found');

    // If session is still STARTING or on step 0 without turns, execute step 0
    let nextIdx = session.lessonPlan.currentStepIndex;
    if (session.state !== 'STARTING' && session.turns.length > 0) {
      nextIdx = session.lessonPlan.currentStepIndex + 1;
    }

    if (nextIdx >= session.lessonPlan.steps.length) {
      return this.concludeClass(session);
    }

    session.state = 'TEACHING';
    return this.executeTeachingStep(session, nextIdx);
  }

  /**
   * Background pre-fetch of the next concept (N+1) while student is listening to concept N.
   */
  async prefetchNextStep(
    classId: string,
    targetStepIndex?: number
  ): Promise<{ success: boolean; prefetchedIndex?: number }> {
    const session = this.classes.get(classId);
    if (!session || !session.lessonPlan) return { success: false };

    const nextIdx =
      targetStepIndex !== undefined ? targetStepIndex : session.lessonPlan.currentStepIndex + 1;
    if (nextIdx >= session.lessonPlan.steps.length) return { success: false };

    // Avoid duplicate prefetch if already cached
    if (session.prefetchedStep && session.prefetchedStep.stepIndex === nextIdx) {
      return { success: true, prefetchedIndex: nextIdx };
    }

    try {
      const step = session.lessonPlan.steps[nextIdx];
      const searchQuery = `${session.documentName} ${step.topic} ${step.concept}`;
      const { citations, combinedContext } = await ragPipeline.retrieveGroundedChunks(
        searchQuery,
        [session.documentId],
        4
      );

      const teacherPrompt = `You are an energetic, clear, elite university professor conducting a 1-to-1 private lecture on "${session.documentName}".
Current Topic: ${step.topic}
Current Concept: ${step.concept}
Step Number: ${nextIdx + 1} of ${session.lessonPlan.steps.length}

GROUNDED COURSE MATERIAL (from course document):
${combinedContext || 'No additional chunk context found.'}

YOUR TASK:
Produce the content for this specific teaching step:
1. "teacherSpeech": What the professor speaks aloud directly to the student. Generate a coherent, natural, engaging teaching paragraph (approx 50-80 words, 3-5 sentences). Sound like a passionate, articulate university professor explaining this concept clearly. Do NOT use bullet points, headings, markdown, or citations in the speech. Speak in a continuous, captivating lecture style.
2. "boardBlocks": 2-3 visual teaching blocks for the live teaching board:
   - "heading" (short title)
   - "bullets" or "definition" or "callout"
3. "studyNote": A concise structured note to save into the student's notebook:
   - "section": "${step.concept}"
   - "content": concise high-yield academic explanation (1-2 sentences)
   - "keyPoints": 2-3 high-yield bullets
4. "understandingCheck": (Only include if stepNumber > 2, otherwise null):
   - "type": "multiple-choice" or "free-response"
   - "question": quick concept check
   - "options": ["A...", "B...", "C...", "D..."] (if multiple choice)
   - "expectedAnswer": correct answer
   - "explanation": why

Return valid JSON strictly matching:
{
  "teacherSpeech": "...",
  "boardTitle": "${step.concept}",
  "boardSubtitle": "${step.topic}",
  "boardBlocks": [
    { "type": "heading", "text": "..." },
    { "type": "bullets", "items": ["..."] }
  ],
  "studyNote": {
    "section": "${step.concept}",
    "content": "...",
    "keyPoints": ["...", "..."]
  },
  "understandingCheck": null
}`;

      let teacherData: any = null;
      try {
        const raw = await azureOpenAI.generateCompletion([
          { role: 'system', content: 'You are an AI university professor teaching a live 1-to-1 class. Return strict JSON.' },
          { role: 'user', content: teacherPrompt },
        ]);
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          teacherData = JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        console.warn('[AIClass Prefetch LLM Error]', err);
      }

      const teacherSpeech =
        teacherData?.teacherSpeech ||
        `Now let's examine ${step.concept}. This concept is critical to how communication systems structure and transmit data efficiently.`;

      let audioUrl: string | undefined = undefined;
      if (speechService.isConfigured()) {
        try {
          const synth = await speechService.synthesize(teacherSpeech);
          if (synth.success && synth.audioDataUrl) {
            audioUrl = synth.audioDataUrl;
          }
        } catch (e) {
          console.warn('[AIClass Prefetch TTS Error]', e);
        }
      }

      session.prefetchedStep = {
        stepIndex: nextIdx,
        session: {
          currentTopic: step.topic,
          currentConcept: step.concept,
          teachingBoard: {
            title: teacherData?.boardTitle || step.concept,
            subtitle: teacherData?.boardSubtitle || step.topic,
            blocks: teacherData?.boardBlocks || [
              { type: 'heading', text: step.concept },
              { type: 'callout', title: 'Key Idea', content: teacherSpeech },
            ],
            highlightedConcept: step.concept,
            sources: citations,
          },
          notes: teacherData?.studyNote
            ? [
                {
                  id: `note_${Date.now()}`,
                  section: teacherData.studyNote.section || step.concept,
                  content: teacherData.studyNote.content || teacherSpeech,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  keyPoints: teacherData.studyNote.keyPoints,
                  sources: citations,
                },
              ]
            : [],
        },
        audioUrl,
        prefetchedAt: Date.now(),
      };

      console.log(`[AIClass Prefetch] Concept ${nextIdx + 1} ("${step.concept}") cached successfully.`);
      return { success: true, prefetchedIndex: nextIdx };
    } catch (err) {
      console.warn('[AIClass Prefetch Error]', err);
      return { success: false };
    }
  }

  /**
   * Executes a specific lesson step:
   * Uses prefetched concept if available (near-seamless), or executes single-pass RAG + LLM.
   */
  private async executeTeachingStep(
    session: AIClassSession,
    stepIndex: number
  ): Promise<{ session: AIClassSession; audioUrl?: string; wasPrefetched?: boolean }> {
    if (!session.lessonPlan) throw new Error('No lesson plan');
    session.lessonPlan.currentStepIndex = stepIndex;

    const currentStep = session.lessonPlan.steps[stepIndex];
    session.currentTopic = currentStep.topic;
    session.currentConcept = currentStep.concept;

    if (!session.topicsCovered.includes(currentStep.concept)) {
      session.topicsCovered.push(currentStep.concept);
    }

    // 1. FAST PATH: Check if this step was already prefetched in the background!
    if (session.prefetchedStep && session.prefetchedStep.stepIndex === stepIndex) {
      console.log(`[AIClass Fast Path] Concept ${stepIndex + 1} ("${currentStep.concept}") loaded from prefetch cache!`);
      const prefetched = session.prefetchedStep;
      session.prefetchedStep = null; // consume cache

      if (prefetched.session.teachingBoard) {
        session.teachingBoard = prefetched.session.teachingBoard;
      }
      if (prefetched.session.notes && prefetched.session.notes.length > 0) {
        session.notes.push(...prefetched.session.notes);
      }

      const turnText =
        (prefetched.session as any)?.teacherSpeech ||
        `Let's explore ${currentStep.concept}. This is essential to mastering this subject.`;

      const turn: ConversationTurn = {
        id: `turn_teach_${Date.now()}`,
        sessionId: session.classId,
        speaker: 'assistant',
        text: turnText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        ttsAudioUrl: prefetched.audioUrl,
        sources: session.teachingBoard.sources,
      };
      session.turns.push(turn);
      session.state = 'TEACHING';

      return { session, audioUrl: prefetched.audioUrl, wasPrefetched: true };
    }

    const tTotal0 = performance.now();
    // 2. STANDARD PATH: Single-pass RAG Retrieval directly from Azure AI Search
    // For the initial lesson concept, retrieve top 2 chunks to minimize latency and prompt overhead
    const tSearch0 = performance.now();
    const searchQuery = `${session.documentName} ${currentStep.topic} ${currentStep.concept}`;
    const topChunks = stepIndex === 0 ? 2 : 3;
    const { citations, combinedContext, timing: searchTiming } = await ragPipeline.retrieveGroundedChunks(
      searchQuery,
      [session.documentId],
      topChunks
    );
    const tSearch1 = performance.now();

    // 3. SPEECH-FIRST GENERATION: Spoken lecture + key points in a single concise generation
    const tLLM0 = performance.now();
    const speechPrompt = `You are an energetic, articulate, elite university professor conducting a 1-to-1 private lecture on "${session.documentName}".
Current Topic: ${currentStep.topic}
Current Concept: ${currentStep.concept}
Step Number: ${stepIndex + 1} of ${session.lessonPlan.steps.length}

GROUNDED COURSE MATERIAL (from course document):
${combinedContext || 'No additional chunk context found.'}

EDUCATIONAL PRINCIPLE:
1. RAG determines WHAT is being taught. GPT determines HOW it is explained.
2. The uploaded material defines the scope of this lesson. Use the retrieved material as the authoritative source for course-specific facts.
3. You may provide additional explanatory context, intuitive simplifications, and relevant analogies only when they directly help the student understand the current concept.
4. Do NOT introduce unrelated topics, unrelated courses, or unsupported factual claims.

YOUR TASK:
Teach this concept directly to your student:
- Introduce the concept clearly.
- Explain what the material specifies in student-friendly language.
- Provide directly relevant intuition, an analogy, or an example where helpful.
- Highlight the primary takeaway.
Generate a captivating, natural lecture paragraph (approx 50-70 words, 3-4 sentences). Do NOT use bullet points, headings, markdown, numbers, or citations in the speech.

Return valid JSON strictly matching:
{
  "teacherSpeech": "...",
  "keyPoints": ["...", "..."],
  "understandingCheck": null
}`;

    let teacherData: any = null;
    try {
      const raw = await azureOpenAI.generateCompletion([
        { role: 'system', content: 'You are an AI university professor teaching a live 1-to-1 class. Return strict JSON.' },
        { role: 'user', content: speechPrompt },
      ]);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        teacherData = JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.warn('[AIClass Step Synthesis Error]', err);
    }
    const tLLM1 = performance.now();

    const teacherSpeech =
      teacherData?.teacherSpeech ||
      `Let's focus now on ${currentStep.concept}. In this subject, this concept is fundamental to understanding how the underlying systems operate reliably.`;

    const keyPoints: string[] =
      teacherData?.keyPoints && Array.isArray(teacherData.keyPoints) && teacherData.keyPoints.length > 0
        ? teacherData.keyPoints
        : [
            `Core principles of ${currentStep.concept}.`,
            `Essential mechanisms and operation within ${currentStep.topic}.`,
          ];

    // 4. Synthesize Azure Speech Audio (MP3 Data URL for instant browser playback)
    const tTTS0 = performance.now();
    let audioUrl: string | undefined = undefined;
    if (speechService.isConfigured()) {
      try {
        const synth = await speechService.synthesize(teacherSpeech);
        if (synth.success && synth.audioDataUrl) {
          audioUrl = synth.audioDataUrl;
        }
      } catch (e) {
        console.warn('[AIClass TTS Error]', e);
      }
    }
    const tTTS1 = performance.now();

    // 5. Update Live Teaching Board (Instant visual rendering, off critical audio path)
    session.teachingBoard = {
      title: currentStep.concept,
      subtitle: currentStep.topic,
      blocks: [
        { type: 'heading', text: currentStep.concept },
        { type: 'bullets', items: keyPoints },
        { type: 'callout', title: 'Professor Insight', content: teacherSpeech },
      ],
      highlightedConcept: currentStep.concept,
      sources: citations,
    };

    // 6. Append Study Note (Instant notebook entry, off critical audio path)
    const note: StudyNote = {
      id: `note_${Date.now()}`,
      section: currentStep.concept,
      content: teacherSpeech,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      keyPoints: keyPoints,
      sources: citations,
    };
    session.notes.push(note);

    // 7. Record Teacher Turn in Transcript
    const turn: ConversationTurn = {
      id: `turn_teach_${Date.now()}`,
      sessionId: session.classId,
      speaker: 'assistant',
      text: teacherSpeech,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      ttsAudioUrl: audioUrl,
      sources: citations,
    };
    session.turns.push(turn);

    // 8. Check if understanding check was triggered
    if (teacherData?.understandingCheck) {
      session.activeCheck = {
        id: `chk_${Date.now()}`,
        type: teacherData.understandingCheck.type || 'multiple-choice',
        question: teacherData.understandingCheck.question,
        options: teacherData.understandingCheck.options,
        expectedAnswer: teacherData.understandingCheck.expectedAnswer,
        explanation: teacherData.understandingCheck.explanation,
        answered: false,
      };
      session.state = 'CHECKING';
    } else {
      session.state = 'TEACHING';
    }

    const timing = {
      embeddingMs: searchTiming?.embeddingMs ?? Math.round(tSearch1 - tSearch0),
      searchMs: searchTiming?.searchMs ?? 0,
      searchTotalMs: Math.round(tSearch1 - tSearch0),
      llmMs: Math.round(tLLM1 - tLLM0),
      ttsMs: Math.round(tTTS1 - tTTS0),
      serverTotalMs: Math.round(performance.now() - tTotal0),
    };

    return { session, audioUrl, wasPrefetched: false, timing };
  }

  /**
   * Student Interruption: Immediately pauses lecture, retrieves grounded answers, and smoothly returns to lesson
   */
  async interrupt(
    classId: string,
    studentQuestion: string
  ): Promise<{ session: AIClassSession; teacherResponse: string; audioUrl?: string }> {
    const session = this.classes.get(classId);
    if (!session) throw new Error('Class not found');

    // Invalidate any prefetched step because student interruption changes lesson context
    session.prefetchedStep = null;

    session.state = 'ANSWERING';
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Record Student Question Turn
    const userTurn: ConversationTurn = {
      id: `turn_usr_intr_${Date.now()}`,
      sessionId: classId,
      speaker: 'user',
      text: studentQuestion,
      timestamp,
      createdAt: new Date().toISOString(),
    };
    session.turns.push(userTurn);

    // Get last teacher statement for conversational context
    const lastTeacherTurn = [...session.turns].reverse().find((t) => t.speaker === 'assistant');
    const lastTeacherText = lastTeacherTurn ? lastTeacherTurn.text : '';

    // 2. Resolve Contextual Query to prevent isolated query degradation (e.g. "Why does it do that?")
    const contextualQuery = await this.resolveContextualQuery(
      session.documentName,
      session.currentTopic || '',
      session.currentConcept || '',
      lastTeacherText,
      studentQuestion
    );
    console.log(`[AIClass Interruption] Reformulated query: "${studentQuestion}" -> "${contextualQuery}"`);

    // 3. Perform Grounded Conversational RAG with resolved query
    const ragResult = await ragPipeline.answerQuestion(
      contextualQuery,
      [session.documentId],
      `The student interrupted the live lecture on "${session.currentConcept}" to ask: "${studentQuestion}". Answer concisely, directly, warmly, and ground your response in the course material.`
    );

    // 4. Create Natural Teacher Response with Transition back to lesson
    const clarifyPrompt = `You are a warm, encouraging university professor conducting a 1-to-1 live class on "${session.documentName}".
The student interrupted the lecture on "${session.currentConcept}" to ask: "${studentQuestion}".

GROUNDED COURSE MATERIAL:
${ragResult.answer}

SCOPE & BOUNDARY RULES:
1. RAG determines WHAT is being taught. GPT determines HOW it is explained.
2. The uploaded material defines the scope of this lesson. Use the retrieved material as the authoritative source for course-specific facts.
3. You may provide additional explanatory context, intuitive analogies, or examples ONLY when they directly help the student understand the current concept ("${session.currentConcept}").
4. If the question is outside the scope of the material or cannot be answered from the document, politely refuse:
   "I couldn't find enough information about that in your selected study material."
5. Do NOT drift into unrelated general topics.
6. Smoothly transition back to the lesson on "${session.currentConcept}".

Produce a warm, natural 2-3 sentence response:
1. Answer the student's question clearly and helpfully.
2. Maintain strict grounding on course material.
3. Smoothly transition back to the lesson (e.g. "Now let's return to our topic of ${session.currentConcept}...").

Return JSON:
{
  "speech": "Spoken teacher words",
  "boardNote": "Brief takeaway for the board"
}`;

    let speech = ragResult.structuredAnswer?.shortAnswer || ragResult.answer.slice(0, 300);
    let boardNote = `Student Question: "${studentQuestion}" — Addressed with grounded material.`;

    try {
      const raw = await azureOpenAI.generateCompletion([
        { role: 'system', content: 'You are an AI professor answering a student interruption. Return strict JSON.' },
        { role: 'user', content: clarifyPrompt },
      ]);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        speech = parsed.speech || speech;
        boardNote = parsed.boardNote || boardNote;
      }
    } catch {
      speech = `Good question! ${ragResult.answer.slice(0, 250)} Now let's return to our lecture on ${session.currentConcept}.`;
    }

    // 5. Synthesize Teacher Spoken Clarification
    let audioUrl: string | undefined = undefined;
    if (speechService.isConfigured()) {
      try {
        const synth = await speechService.synthesize(speech);
        if (synth.success && synth.audioDataUrl) {
          audioUrl = synth.audioDataUrl;
        }
      } catch (err) {
        console.warn('[AIClass Interruption TTS Error]', err);
      }
    }

    // 5. Update Teaching Board with Interruption Callout
    session.teachingBoard.blocks.push({
      type: 'callout',
      title: `Student Question: ${studentQuestion}`,
      content: boardNote,
    });
    if (ragResult.sources && ragResult.sources.length > 0) {
      session.teachingBoard.sources = ragResult.sources;
    }

    // 6. Record Teacher Response Turn
    const asstTurn: ConversationTurn = {
      id: `turn_asst_intr_${Date.now()}`,
      sessionId: classId,
      speaker: 'assistant',
      text: speech,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      ttsAudioUrl: audioUrl,
      sources: ragResult.sources,
      isGrounded: ragResult.structuredAnswer?.isGrounded !== false,
    };
    session.turns.push(asstTurn);

    // 7. Return to TEACHING state
    session.state = 'TEACHING';

    return { session, teacherResponse: speech, audioUrl };
  }

  /**
   * Evaluates student's answer to an Understanding Check
   */
  async answerCheck(
    classId: string,
    userAnswer: string
  ): Promise<{ session: AIClassSession; feedback: string; isCorrect: boolean }> {
    const session = this.classes.get(classId);
    if (!session || !session.activeCheck) throw new Error('No active understanding check found');

    const check = session.activeCheck;
    check.answered = true;
    check.userAnswer = userAnswer;

    // Evaluate answer against expected answer & grounded material
    const evalPrompt = `Evaluate student's answer to understanding check.
Question: ${check.question}
Expected Answer: ${check.expectedAnswer}
Student Answer: ${userAnswer}

Return JSON:
{
  "isCorrect": true/false,
  "result": "correct" | "partially-correct" | "needs-review",
  "feedback": "2 sentence encouraging professor feedback explaining why"
}`;

    let isCorrect = true;
    let feedback = 'Well done! That accurately captures the principle.';
    try {
      const raw = await azureOpenAI.generateCompletion([
        { role: 'system', content: 'You evaluate student answers for an AI professor. Return JSON.' },
        { role: 'user', content: evalPrompt },
      ]);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        isCorrect = parsed.isCorrect;
        check.result = parsed.result || (isCorrect ? 'correct' : 'needs-review');
        feedback = parsed.feedback || feedback;
      }
    } catch {
      check.result = 'correct';
    }

    check.feedback = feedback;
    session.state = 'TEACHING';

    return { session, feedback, isCorrect };
  }

  async pauseClass(classId: string): Promise<AIClassSession> {
    const session = this.classes.get(classId);
    if (!session) throw new Error('Class not found');
    session.state = 'PAUSED';
    return session;
  }

  async resumeClass(classId: string): Promise<AIClassSession> {
    const session = this.classes.get(classId);
    if (!session) throw new Error('Class not found');
    session.state = 'TEACHING';
    return session;
  }

  private async concludeClass(session: AIClassSession): Promise<{ session: AIClassSession; audioUrl?: string }> {
    session.state = 'COMPLETED';
    session.endedAt = new Date().toISOString();
    const startMs = new Date(session.startedAt).getTime();
    const endMs = new Date(session.endedAt).getTime();
    session.durationSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));

    const concludingSpeech = `Excellent work today! We have completed all scheduled concepts for ${session.documentName}. Your study notes and complete transcript are now ready to review or download.`;

    let audioUrl: string | undefined = undefined;
    if (speechService.isConfigured()) {
      try {
        const synth = await speechService.synthesize(concludingSpeech);
        if (synth.success && synth.audioDataUrl) {
          audioUrl = synth.audioDataUrl;
        }
      } catch (e) {
        console.warn('[AIClass Concluding TTS Error]', e);
      }
    }

    session.summary = {
      topicsDiscussed: session.topicsCovered,
      keyConcepts: session.notes.map((n) => n.section),
      questionsAsked: session.turns.filter((t) => t.speaker === 'user').map((t) => t.text),
      importantTakeaways: session.notes.flatMap((n) => n.keyPoints || []),
      summaryText: `Comprehensive 1-to-1 private lecture on ${session.documentName} covering ${session.topicsCovered.length} core concepts.`,
    };

    return { session, audioUrl };
  }

  private async resolveContextualQuery(
    documentName: string,
    currentTopic: string,
    currentConcept: string,
    lastTeacherText: string,
    studentQuestion: string
  ): Promise<string> {
    const prompt = `You are resolving a student's question in a live university classroom into an optimal search query against course materials.
Course Document: "${documentName}"
Current Topic: "${currentTopic}"
Current Concept: "${currentConcept}"
Teacher Spoke: "${lastTeacherText ? lastTeacherText.slice(0, 300) : ''}"
Student Asked: "${studentQuestion}"

Extract a 3-8 word targeted academic search query to find the exact explanation in the course text.
Return ONLY the search query string, nothing else.`;

    try {
      const reformulated = await azureOpenAI.generateCompletion([
        { role: 'system', content: 'You are an expert query reformulation assistant. Return ONLY the search query string.' },
        { role: 'user', content: prompt },
      ]);
      const clean = reformulated.replace(/["\n\r]/g, '').trim();
      if (clean && clean.length > 3) {
        return clean;
      }
    } catch {
      // Fallback
    }
    return `${currentConcept} ${studentQuestion}`;
  }

  async endClass(classId: string): Promise<AIClassSession> {
    const session = this.classes.get(classId);
    if (!session) throw new Error('Class not found');
    const result = await this.concludeClass(session);
    return result.session;
  }

  async exportNotesPdf(classId: string): Promise<Buffer> {
    const session = this.classes.get(classId);
    if (!session) throw new Error('Class not found');

    const exportNotes = session.notes.map((n) => ({
      section: n.section,
      content: n.content,
      timestamp: n.timestamp,
      keyPoints: n.keyPoints,
      sources: n.sources?.map((s) => ({ documentName: s.documentName, pageNumber: s.pageNumber })),
    }));

    return pdfExportService.generateNotesPdf(
      `STUDY NOTES: ${session.documentName}`,
      session.documentName,
      exportNotes,
      session.summary?.summaryText
    );
  }

  async exportTranscriptPdf(classId: string): Promise<Buffer> {
    const session = this.classes.get(classId);
    if (!session) throw new Error('Class not found');

    const durationStr = `${Math.floor((session.durationSeconds || 0) / 60)}m ${(session.durationSeconds || 0) % 60}s`;
    const exportTurns = session.turns.map((t) => ({
      speaker: t.speaker,
      text: t.text,
      timestamp: t.timestamp,
      sources: t.sources?.map((s) => ({ documentName: s.documentName, pageNumber: s.pageNumber })),
    }));

    return pdfExportService.generateTranscriptPdf(
      session.documentName,
      exportTurns,
      durationStr,
      session.summary?.summaryText
    );
  }

  exportTxt(classId: string): string {
    const session = this.classes.get(classId);
    if (!session) throw new Error('Class not found');

    const lines: string[] = [
      '==================================================',
      `AI LIVE CLASS STUDY NOTES & TRANSCRIPT`,
      `Document: ${session.documentName}`,
      `Date: ${new Date(session.startedAt).toLocaleDateString()}`,
      `Duration: ${Math.floor((session.durationSeconds || 0) / 60)}m`,
      '==================================================\n',
      'STUDY NOTES:',
    ];

    for (const note of session.notes) {
      lines.push(`\n[${note.section}]`);
      lines.push(note.content);
      if (note.keyPoints) {
        note.keyPoints.forEach((p) => lines.push(`• ${p}`));
      }
      if (note.sources) {
        lines.push(`Sources: ${note.sources.map((s) => `${s.documentName} p.${s.pageNumber}`).join(', ')}`);
      }
    }

    lines.push('\n==================================================\nCLASS TRANSCRIPT:');
    for (const turn of session.turns) {
      lines.push(`[${turn.timestamp}] ${turn.speaker === 'user' ? 'STUDENT' : 'AI PROFESSOR'}: ${turn.text}`);
    }

    return lines.join('\n');
  }
}

export const aiClassService = new AIClassService();

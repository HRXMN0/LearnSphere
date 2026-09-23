import { ragPipeline } from './ragPipeline';
import { azureOpenAI } from './azureOpenAIService';
import { speechService } from './speechService';
import { pdfExportService } from './pdfExportService';
import { ConversationTurn, SessionSummary, StudySession } from '../../src/types/studySession';

export class StudySessionService {
  private sessions: Map<string, StudySession> = new Map();

  async createSession(documentId: string): Promise<StudySession> {
    const docs = await ragPipeline.getDocuments();
    const doc = docs.find((d) => d.id === documentId) || docs[0];

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session: StudySession = {
      sessionId,
      documentId: doc ? doc.id : documentId,
      documentName: doc ? doc.name : 'Selected Document',
      documentPages: doc ? doc.pages : 1,
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      status: 'active',
      turns: [
        {
          id: `turn_welcome_${Date.now()}`,
          sessionId,
          speaker: 'assistant',
          text: `Hi! I'm your private AI study tutor for "${doc ? doc.name : 'your course material'}". You can speak or type any question, and I'll explain it grounded directly in this document.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: new Date().toISOString(),
          structuredAnswer: {
            shortAnswer: `Hi! I'm your private AI study tutor for "${doc ? doc.name : 'your course material'}". You can speak or type any question, and I'll explain it grounded directly in this document.`,
            title: 'Welcome to Your Study Session',
            overview: `I am ready to help you explore and master ${doc ? doc.name : 'your course material'}. Feel free to speak naturally or ask for simpler analogies, step-by-step breakdowns, comparisons, or quizzes.`,
          },
          isGrounded: true,
        },
      ],
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): StudySession | undefined {
    return this.sessions.get(sessionId);
  }

  async addTurn(
    sessionId: string,
    userText: string,
    generateAudio = true
  ): Promise<{ userTurn: ConversationTurn; assistantTurn: ConversationTurn }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Study session "${sessionId}" not found.`);
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Record User Turn
    const userTurn: ConversationTurn = {
      id: `turn_user_${Date.now()}`,
      sessionId,
      speaker: 'user',
      text: userText,
      timestamp,
      createdAt: new Date().toISOString(),
    };
    session.turns.push(userTurn);

    // 2. Build multi-turn context for search query reformulation
    const recentHistory = session.turns
      .slice(-6, -1)
      .map((t) => `${t.speaker === 'user' ? 'Student' : 'Tutor'}: ${t.text}`)
      .join('\n');

    // 3. Execute Conversational RAG
    const ragResult = await ragPipeline.answerQuestion(
      userText,
      [session.documentId],
      recentHistory
    );

    // 4. Generate pure learner-facing audio if requested
    let ttsAudioUrl: string | undefined = undefined;
    if (generateAudio && speechService.isConfigured()) {
      try {
        const speechText = ragResult.structuredAnswer?.overview
          ? `${ragResult.structuredAnswer.title ? ragResult.structuredAnswer.title + '. ' : ''}${ragResult.structuredAnswer.overview}`
          : ragResult.answer.replace(/\[\^.*?\]/g, '').slice(0, 400);

        const synth = await speechService.synthesize(speechText);
        if (synth.success && synth.audioUrl) {
          ttsAudioUrl = synth.audioUrl;
        }
      } catch (err) {
        console.warn('[StudySession TTS Error]', err);
      }
    }

    // 5. Record Assistant Turn
    const assistantTurn: ConversationTurn = {
      id: `turn_asst_${Date.now()}`,
      sessionId,
      speaker: 'assistant',
      text: ragResult.answer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      structuredAnswer: ragResult.structuredAnswer,
      sources: ragResult.sources,
      ttsAudioUrl,
      isGrounded: ragResult.structuredAnswer?.isGrounded !== false && ragResult.sources.length > 0,
    };
    session.turns.push(assistantTurn);

    return { userTurn, assistantTurn };
  }

  async endSession(sessionId: string): Promise<StudySession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Study session "${sessionId}" not found.`);
    }

    session.endedAt = new Date().toISOString();
    const startMs = new Date(session.startedAt).getTime();
    const endMs = new Date(session.endedAt).getTime();
    session.durationSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));
    session.status = 'completed';

    // Generate grounded session summary
    const userQuestions = session.turns.filter((t) => t.speaker === 'user').map((t) => t.text);
    const tutorAnswers = session.turns.filter((t) => t.speaker === 'assistant').map((t) => t.text);

    if (userQuestions.length > 0) {
      try {
        const summaryPrompt = `Based ONLY on the following study session Q&A turns, provide a concise academic summary.
Questions asked:
${userQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}

Answers given:
${tutorAnswers.slice(0, 6).join('\n---\n')}

Return JSON with:
{
  "topicsDiscussed": ["topic1", "topic2"],
  "keyConcepts": ["concept1", "concept2"],
  "questionsAsked": ["q1", "q2"],
  "importantTakeaways": ["takeaway1", "takeaway2"],
  "summaryText": "2-3 sentence grounded summary"
}`;

        const raw = await azureOpenAI.generateCompletion([
          { role: 'system', content: 'You summarize student study sessions strictly from the provided turns.' },
          { role: 'user', content: summaryPrompt },
        ]);

        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          session.summary = JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        console.warn('[StudySession Summary Error]', err);
      }
    }

    if (!session.summary) {
      session.summary = {
        topicsDiscussed: [session.documentName],
        keyConcepts: ['Document study session'],
        questionsAsked: userQuestions,
        importantTakeaways: ['Reviewed course material.'],
        summaryText: `Study session covering ${session.documentName} with ${userQuestions.length} questions answered.`,
      };
    }

    return session;
  }

  exportTxt(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const lines: string[] = [
      '==================================================',
      `AI STUDY CONVERSATION TRANSCRIPT`,
      `Document: ${session.documentName}`,
      `Date: ${new Date(session.startedAt).toLocaleDateString()}`,
      `Duration: ${Math.floor(session.durationSeconds / 60)}m ${session.durationSeconds % 60}s`,
      '==================================================\n',
    ];

    for (const turn of session.turns) {
      lines.push(`[${turn.timestamp}] ${turn.speaker === 'user' ? 'YOU' : 'AI TUTOR'}:`);
      lines.push(turn.text);
      if (turn.sources && turn.sources.length > 0) {
        lines.push(`Sources: ${turn.sources.map((s) => `${s.documentName} (p. ${s.pageNumber})`).join(', ')}`);
      }
      lines.push('\n--------------------------------------------------\n');
    }

    if (session.summary) {
      lines.push('SESSION SUMMARY:');
      lines.push(session.summary.summaryText);
      lines.push('\nKEY CONCEPTS:');
      session.summary.keyConcepts.forEach((c) => lines.push(`• ${c}`));
      lines.push('\nTAKEAWAYS:');
      session.summary.importantTakeaways.forEach((t) => lines.push(`• ${t}`));
    }

    return lines.join('\n');
  }

  async exportPdf(sessionId: string): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const durationStr = `${Math.floor(session.durationSeconds / 60)}m ${session.durationSeconds % 60}s`;
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
}

export const studySessionService = new StudySessionService();

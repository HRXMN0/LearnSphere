import { QuizConfiguration, QuizQuestion, QuizSubmission } from '../types/quiz';
import { DEMO_QUIZ_QUESTIONS } from '../data/demoData';

export interface IQuizService {
  generateQuiz(config: QuizConfiguration, isDemoMode?: boolean): Promise<QuizQuestion[]>;
  evaluateQuiz(quizId: string, userAnswers: { [questionId: string]: number }, questionsList?: QuizQuestion[], options?: { documentId?: string; topic?: string; isDemoMode?: boolean }): Promise<QuizSubmission>;
}

export class RealQuizService implements IQuizService {
  async generateQuiz(config: QuizConfiguration, isDemoMode: boolean = false): Promise<QuizQuestion[]> {
    if (isDemoMode) {
      const count = Math.min(config.questionCount, DEMO_QUIZ_QUESTIONS.length);
      return DEMO_QUIZ_QUESTIONS.slice(0, count);
    }

    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: config.materialId ? [config.materialId] : [],
          topic: config.topic,
          questionCount: config.questionCount || 5,
          difficulty: config.difficulty || 'Medium',
          chunkIds: config.chunkIds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
          return data.questions.map((q: any, i: number) => ({
            id: q.id || `q_${i + 1}`,
            questionNumber: i + 1,
            prompt: q.prompt,
            type: q.type || 'MCQ',
            options: q.options || [],
            correctAnswerIndex: typeof q.correctAnswerIndex === 'number' ? q.correctAnswerIndex : 0,
            explanation: q.explanation || 'Answer rationale generated from course material.',
            sourceReference: {
              documentName: q.sourceReference?.documentName || 'Course Material',
              page: q.sourceReference?.page || 1,
              topic: config.topic,
            },
          }));
        }
        throw new Error('No quiz questions returned from uploaded material. Ensure documents contain relevant content.');
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `Quiz generation failed with status ${response.status}`);
    } catch (err: any) {
      console.error('Real quiz generation failed:', err);
      // Never silently fall back to mock data in LIVE mode per Directive 17 & 18
      throw err;
    }
  }

  async evaluateQuiz(
    quizId: string,
    userAnswers: { [questionId: string]: number },
    questionsList: QuizQuestion[] = DEMO_QUIZ_QUESTIONS,
    options?: { documentId?: string; topic?: string; isDemoMode?: boolean }
  ): Promise<QuizSubmission> {
    // In live mode, delegate to server-side authoritative evaluation
    if (!options?.isDemoMode) {
      try {
        const response = await fetch('/api/quiz/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quizId,
            documentId: options?.documentId,
            topic: options?.topic || questionsList[0]?.sourceReference?.topic || 'General Practice',
            userAnswers,
            questions: questionsList,
          }),
        });

        if (response.ok) {
          return await response.json();
        }
        console.warn('[QuizService] Server-side evaluation failed, falling back to local:', response.status);
      } catch (err) {
        console.warn('[QuizService] Server-side evaluation error, falling back to local:', err);
      }
    }

    // Demo mode or fallback: client-side evaluation (no analytics event recorded)
    let score = 0;
    const questions = questionsList;
    const weakTopics: string[] = [];
    const strongTopics: string[] = [];

    questions.forEach((q) => {
      const selected = userAnswers[q.id];
      if (selected === q.correctAnswerIndex) {
        score++;
        if (!strongTopics.includes(q.sourceReference.topic)) {
          strongTopics.push(q.sourceReference.topic);
        }
      } else {
        if (!weakTopics.includes(q.sourceReference.topic)) {
          weakTopics.push(q.sourceReference.topic);
        }
      }
    });

    const percentage = Math.round((score / Math.max(1, questions.length)) * 100);
    const recommendedRevision = weakTopics.length > 0
      ? weakTopics.map((t) => `Review "${t}" in your uploaded course materials.`)
      : ['Strong performance across all evaluated topics!'];

    return {
      quizId,
      totalQuestions: questions.length,
      score,
      percentage,
      userAnswers,
      weakTopics: weakTopics.length > 0 ? weakTopics : ['None detected - flawless run!'],
      strongTopics,
      recommendedRevision,
      completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }
}

export const quizService = new RealQuizService();

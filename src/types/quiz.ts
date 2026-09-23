export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';
export type QuizQuestionType = 'MCQ' | 'True/False' | 'Short Answer';

export interface QuizQuestion {
  id: string;
  questionNumber: number;
  prompt: string;
  type: QuizQuestionType;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  sourceReference: {
    documentName: string;
    page: number;
    topic: string;
  };
}

export interface QuizConfiguration {
  materialId: string;
  topic: string;
  difficulty: QuizDifficulty;
  questionCount: number;
  questionType: QuizQuestionType;
  conceptId?: string;
  chunkIds?: string[];
}

export interface QuizSubmission {
  quizId: string;
  totalQuestions: number;
  score: number;
  percentage: number;
  userAnswers: { [questionId: string]: number };
  weakTopics: string[];
  strongTopics: string[];
  recommendedRevision: string[];
  completedAt: string;
}

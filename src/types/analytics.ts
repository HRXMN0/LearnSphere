import { MasteryStatus } from '../utils/mastery';

export interface StudyOverviewMetrics {
  questionsAsked: number;
  documentsIndexed: number;
  quizzesCompleted: number;
  averageQuizScore: number;
  topicsMastered: number;
  studyHoursThisWeek: number;
}

export interface TopicMastery {
  topic: string;
  category: string;
  masteryPercentage: number;
  quizzesTaken: number;
  status: MasteryStatus;
  conceptId?: string;
  documentId?: string;
  documentName?: string;
  attempts?: number;
  correctAnswers?: number;
  lastPracticedAt?: string;
}

export interface WeeklyActivityPoint {
  day: string;
  date?: string;
  questions: number;
  quizzes: number;
}

export interface RecommendedFocus {
  conceptId?: string;
  documentId?: string;
  documentName?: string;
  topic: string;
  reason: string;
}

export interface InsightsData {
  questionsAsked: number;
  questionsToday: number;
  documents: number;
  indexedDocuments: number;
  quizzesCompleted: number;
  averageScore: number | null;
  studyHours: number;
  studyHoursThisWeek: number;
  weeklyActivity: WeeklyActivityPoint[];
  topics: TopicMastery[];
  recommendedFocus: RecommendedFocus;
  generatedAt: string;
}

export type LearningEventType =
  | 'question_submitted'
  | 'quiz_completed'
  | 'practice_completed'
  | 'study_session_ended'
  | 'live_class_ended'
  | 'document_indexed';

export interface LearningEvent {
  id: string; // Unique eventId for idempotency
  type: LearningEventType;
  timestamp: string; // ISO string
  documentId?: string;
  documentName?: string;
  conceptId?: string;
  topic?: string;
  metadata?: Record<string, any>;
}

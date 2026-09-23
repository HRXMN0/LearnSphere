import { SourceCitation } from './chat';
import { StructuredAnswer } from './chat';

export interface ConversationTurn {
  id: string;
  sessionId: string;
  speaker: 'user' | 'assistant';
  text: string;
  timestamp: string;
  createdAt: string;
  structuredAnswer?: StructuredAnswer;
  sources?: SourceCitation[];
  ttsAudioUrl?: string;
  isGrounded?: boolean;
}

export interface SessionSummary {
  topicsDiscussed: string[];
  keyConcepts: string[];
  questionsAsked: string[];
  importantTakeaways: string[];
  summaryText: string;
}

export interface StudySession {
  sessionId: string;
  documentId: string;
  documentName: string;
  documentPages: number;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  status: 'active' | 'completed';
  turns: ConversationTurn[];
  summary?: SessionSummary;
}

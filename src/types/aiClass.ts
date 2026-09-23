import { SourceCitation } from './chat';
import { ConversationTurn, SessionSummary } from './studySession';

export type TeachingBlock =
  | { type: 'heading'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'definition'; term: string; explanation: string }
  | { type: 'example'; title: string; content: string }
  | { type: 'comparison'; columns: string[]; rows: string[][] }
  | { type: 'callout'; title: string; content: string }
  | { type: 'visual'; imageUrl: string; caption?: string };

export interface TeachingBoardState {
  title: string;
  subtitle?: string;
  blocks: TeachingBlock[];
  highlightedConcept?: string;
  sources: SourceCitation[];
}

export interface StudyNote {
  id: string;
  section: string;
  content: string;
  timestamp: string;
  keyPoints?: string[];
  sources?: SourceCitation[];
}

export interface UnderstandingCheck {
  id: string;
  type: 'multiple-choice' | 'free-response';
  question: string;
  options?: string[];
  expectedAnswer?: string;
  explanation?: string;
  answered: boolean;
  userAnswer?: string;
  result?: 'correct' | 'partially-correct' | 'needs-review';
  feedback?: string;
}

export type ClassStartupState =
  | 'READY'
  | 'STARTING'
  | 'READY_TO_TEACH'
  | 'TEACHING'
  | 'LISTENING'
  | 'PAUSED'
  | 'ERROR';

export type ClassState =
  | 'CLASS_READY'
  | 'CLASS_STARTING'
  | 'STARTING'
  | 'READY_TO_TEACH'
  | 'TEACHING'
  | 'LISTENING'
  | 'ANSWERING'
  | 'CHECKING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ERROR';

export interface LessonStep {
  id: string;
  topic: string;
  concept: string;
  teacherSpeech: string;
  boardState: TeachingBoardState;
  note: StudyNote;
  understandingCheck?: UnderstandingCheck;
}

export interface PrefetchedStepData {
  stepIndex: number;
  session: Partial<AIClassSession>;
  audioUrl?: string;
  prefetchedAt: number;
}

export interface AIClassSession {
  classId: string;
  documentId: string;
  documentName: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  currentTopic?: string;
  currentConcept?: string;
  state: ClassState;
  teachingBoard: TeachingBoardState;
  notes: StudyNote[];
  turns: ConversationTurn[];
  topicsCovered: string[];
  activeCheck?: UnderstandingCheck;
  summary?: SessionSummary;
  prefetchedStep?: PrefetchedStepData | null;
  lessonPlan?: {
    overview: string;
    steps: Array<{ id: string; topic: string; concept: string }>;
    currentStepIndex: number;
  };
}

export type AICapability = 'RAG GROUNDED' | 'VISION' | 'GENERATIVE AI';

export interface SourceCitation {
  id: string;
  documentId: string;
  documentName: string;
  page: number;
  pageNumber?: number;
  section: string;
  excerpt: string;
  relevance: number; // e.g. 0.94 -> 94%
}

export interface ComparisonRow {
  feature: string;
  colA: string;
  colB: string;
}

export type AnswerType =
  | 'concept_explanation'
  | 'step_by_step'
  | 'comparison'
  | 'definition'
  | 'summary'
  | 'example'
  | 'quiz'
  | 'application'
  | 'process_mechanism'
  | 'general_question';

export type AnswerSectionType = 'paragraph' | 'steps' | 'bullets' | 'table' | 'callout' | 'quiz_interactive';

export interface QuizQuestionItem {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex?: number;
  explanation?: string;
}

export interface StructuredAnswerSection {
  heading: string;
  type: AnswerSectionType;
  content?: string;
  items?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  calloutType?: 'info' | 'analogy' | 'warning' | 'remember';
  quizQuestions?: QuizQuestionItem[];
}

export interface StructuredAnswer {
  isGrounded?: boolean;
  answerType?: AnswerType;
  title?: string;
  overview?: string;
  shortAnswer: string;
  sections?: StructuredAnswerSection[];
  keyDifferences?: {
    headerA: string;
    headerB: string;
    rows: ComparisonRow[];
  };
  explanation?: string[];
  inSimpleTerms?: string;
  bulletPoints?: string[];
  stepByStep?: string[];
  keyTakeaways?: string[];
  recommendedVisual?: {
    type: 'flowchart' | 'mindmap' | 'diagram';
    reason: string;
  };
}

export interface RAGDebugInfo {
  documentIdsFilter?: string[];
  filterExpression?: string;
  totalRetrieved: number;
  retrievedPages: number[];
  scores: Array<{ chunkId: string; score: number; pageNumber: number }>;
  groundingDecision: string;
  model: string;
  searchIndex: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  capabilities?: AICapability[];
  structuredAnswer?: StructuredAnswer;
  sources?: SourceCitation[];
  diagramPreviewUrl?: string;
  suggestedFollowUps?: string[];
  isError?: boolean;
  debugInfo?: RAGDebugInfo;
}

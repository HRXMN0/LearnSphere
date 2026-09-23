export type DocumentStatus = 'ready' | 'processing' | 'indexing' | 'failed';

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  page: number;
  section: string;
  content: string;
  relevanceScore?: number;
}

export interface DocumentTopic {
  id: string;
  name: string;
  description: string;
  sourcePages?: number[];
}

export interface DocumentProfile {
  documentId: string;
  documentName: string;
  title: string;
  subject: string;
  mainTopic: string;
  topics: DocumentTopic[];
  keyConcepts: string[];
  suggestedQuestions: string[];
}

export type TopicLevel = 'unit' | 'section' | 'concept';

export interface CourseTopicNode {
  id: string;
  title: string;
  description?: string;
  parentId?: string;
  level: TopicLevel;
  documentId: string;
  documentName: string;
  pageStart?: number;
  pageEnd?: number;
  chunkIds: string[];
  keywords: string[];
  order: number;
  children?: CourseTopicNode[];
}

export interface CourseTopicMap {
  documentId: string;
  documentName: string;
  courseTitle: string;
  totalUnits: number;
  totalSections: number;
  totalConcepts: number;
  nodes: CourseTopicNode[];
  tree: CourseTopicNode[];
  generatedAt: string;
}

export interface ActiveConceptContext {
  documentId: string;
  documentName: string;
  unitTitle?: string;
  sectionTitle?: string;
  conceptId: string;
  conceptTitle: string;
  conceptDescription?: string;
  pageStart?: number;
  pageEnd?: number;
  chunkIds: string[];
  keywords?: string[];
}

export interface LearningDocument {
  id: string;
  name: string;
  type: 'pdf' | 'notes' | 'slides' | 'image' | 'cheatsheet';
  size: string;
  pages: number;
  sectionsCount?: number;
  diagramsCount?: number;
  tablesCount?: number;
  uploadedAt: string;
  status: DocumentStatus;
  processingProgress?: number;
  processingStep?: string;
  topicCategory: string;
  description?: string;
  chunks?: DocumentChunk[];
  profile?: DocumentProfile;
  topicMap?: CourseTopicMap;
}

export interface DocumentUploadSimulationStep {
  step: 'uploading' | 'reading' | 'extracting' | 'indexing' | 'ready';
  label: string;
  progress: number;
}


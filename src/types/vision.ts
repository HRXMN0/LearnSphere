import { AICapability } from './chat';

export interface DiagramBoundingBox {
  id: string;
  label: string;
  x: number; // percentage 0-100
  y: number;
  width: number;
  height: number;
  description: string;
}

export interface VisionAnalysis {
  id: string;
  title: string;
  imageUrl: string;
  capabilities: AICapability[];
  whatISee: string;
  keyConcepts: string[];
  stepByStep: {
    stepNumber: number;
    title: string;
    description: string;
    senderReceiver?: string;
  }[];
  detailedExplanation: string;
  importantLabels: {
    tag: string;
    description: string;
    category: 'flag' | 'node' | 'state' | 'concept';
  }[];
  boundingBoxes?: DiagramBoundingBox[];
  relatedDocumentSource?: {
    documentName: string;
    page: number;
  };
  fileName?: string;
  fileSize?: string;
  mimeType?: string;
  isDemo?: boolean;
  isIndexedInRAG?: boolean;
}

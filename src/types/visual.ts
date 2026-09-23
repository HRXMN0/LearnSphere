export type VisualType = 'flowchart' | 'mindmap' | 'diagram';

export interface VisualNode {
  id: string;
  label: string;
  type?: 'start' | 'process' | 'decision' | 'end';
  detail?: string;
}

export interface VisualEdge {
  from: string;
  to: string;
  label?: string;
}

export interface FlowchartSpec {
  type: 'flowchart';
  title: string;
  description?: string;
  nodes: VisualNode[];
  edges: VisualEdge[];
  groundingSource?: {
    documentName: string;
    page?: number;
  };
}

export interface MindMapBranch {
  label: string;
  description?: string;
  children?: Array<string | { label: string; description?: string }>;
}

export interface MindMapSpec {
  type: 'mindmap';
  title: string;
  root: string;
  branches: MindMapBranch[];
  groundingSource?: {
    documentName: string;
    page?: number;
  };
}

export interface DiagramComponent {
  id: string;
  label: string;
  role?: string;
  group?: string;
}

export interface DiagramConnection {
  from: string;
  to: string;
  relationship?: string;
}

export interface DiagramSpec {
  type: 'diagram';
  title: string;
  description?: string;
  components: DiagramComponent[];
  connections: DiagramConnection[];
  groundingSource?: {
    documentName: string;
    page?: number;
  };
}

export type VisualSpec = FlowchartSpec | MindMapSpec | DiagramSpec;

export interface VisualRecommendation {
  recommendedType: VisualType;
  reason: string;
}

export interface VisualGenerationResult {
  success: boolean;
  isGrounded: boolean;
  visual?: VisualSpec;
  visualType: VisualType;
  message?: string;
  error?: string;
}

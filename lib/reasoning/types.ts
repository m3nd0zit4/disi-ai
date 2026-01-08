export type SemanticRole = 
  | "instruction" 
  | "knowledge" 
  | "example" 
  | "constraint" 
  | "history" 
  | "context" 
  | "evidence" 
  | "critique";

export interface ReasoningNode {
  id: string;
  type: string;
  data: {
    text?: string;
    output?: string;
    prompt?: string;
    mediaUrl?: string;
    status?: string;
    role?: SemanticRole;
    importance?: number; // 1-5
    [key: string]: unknown;
  };
  position?: { x: number; y: number };
}

export interface ReasoningEdge {
  source: string;
  target: string;
  relation?: string;
}

export interface ReasoningContextItem {
  sourceNodeId: string;
  nodeType: string;
  role: SemanticRole;
  content: string;
  importance: number;
  relation?: string;
  isSummarized?: boolean;
}

export interface ReasoningContext {
  targetNodeId: string;
  items: ReasoningContextItem[];
  totalTokens?: number;
  isDistilled?: boolean;
}

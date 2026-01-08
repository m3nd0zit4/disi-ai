import { SemanticRole } from "@/lib/reasoning/types";

export interface BaseNodeData {
  id?: string;
  createdAt?: number;
  color?: string;
  role?: SemanticRole;
  importance?: number;
}

export interface InputNodeData extends BaseNodeData {
  text: string;
}

export interface ResponseNodeData extends BaseNodeData {
  text: string; // Kept for backward compatibility (maps to content.markdown)
  modelId: string;
  status: "pending" | "thinking" | "streaming" | "complete" | "error";
  reasoning?: string; // Kept for backward compatibility
  structuredReasoning?: {
    text: string;
    durationMs?: number;
  };
  content?: {
    markdown?: string;
    imageUrl?: string;
  };
  isProModel?: boolean;
  isUserFree?: boolean;
  error?: string;
  errorType?: string;
}

export interface DisplayNodeData extends BaseNodeData {
  type: "text" | "image" | "video";
  content?: string;
  text?: string;
  mediaUrl?: string;
  mediaStorageId?: string;
  status?: "pending" | "thinking" | "streaming" | "complete" | "error";
  modelId?: string;
}

export type NodeData = 
  | InputNodeData 
  | ResponseNodeData 
  | DisplayNodeData;

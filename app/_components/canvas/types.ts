import { SemanticRole } from "@/lib/reasoning/types";

export interface BaseNodeData {
  id?: string;
  createdAt?: number;
  color?: string;
  role?: SemanticRole;
  importance?: number;
}

export interface InputNodeData {
  text: string;
  id?: string; // Added from BaseNodeData
  createdAt?: number; // Added from BaseNodeData
  color?: string; // Added from BaseNodeData
  attachments?: { url?: string; storageId?: string; type?: string; name?: string }[];
  role?: SemanticRole; // Added from BaseNodeData
  importance?: number; // Added from BaseNodeData
  executionId?: string;
  status?: "pending" | "thinking" | "complete" | "error";
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
  executionId?: string;
}

export interface DisplayNodeData extends BaseNodeData {
  type: "text" | "image" | "video";
  content?: string;
  text?: string;
  mediaUrl?: string;
  mediaStorageId?: string;
  status?: "pending" | "thinking" | "streaming" | "complete" | "error";
  modelId?: string;
  executionId?: string;
  metadata?: {
    width?: number;
    height?: number;
  };
}

export interface FileNodeData extends BaseNodeData {
  fileName: string;
  fileType: string;
  fileSize: number;
  storageId: string;
  uploadStatus: "pending" | "uploading" | "complete" | "error";
  textContent?: string;
  previewUrl?: string;
}

export type NodeData = 
  | InputNodeData 
  | ResponseNodeData 
  | DisplayNodeData
  | FileNodeData;

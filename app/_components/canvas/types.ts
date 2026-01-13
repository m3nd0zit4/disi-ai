import { SemanticRole } from "@/lib/reasoning/types";

export interface BaseNodeData {
  id?: string;
  createdAt?: number;
  color?: string;
  role?: SemanticRole;
  importance?: number;
  executionId?: string;
  status?: "pending" | "thinking" | "streaming" | "complete" | "error" | "uploading";
  prompt?: string;
  text?: string;
}


export interface InputNodeData extends BaseNodeData {
  attachments?: { url?: string; storageId?: string; type?: string; name?: string }[];
}

export interface ResponseNodeData extends BaseNodeData {
  modelId: string;
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
  reasoning?: string; // Kept for backward compatibility
}

export interface DisplayNodeData extends BaseNodeData {
  type: "text" | "image" | "video";
  content?: string;
  mediaUrl?: string;
  mediaStorageId?: string;
  modelId?: string;
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


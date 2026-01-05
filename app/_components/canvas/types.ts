export interface BaseNodeData {
  id?: string;
  createdAt?: number;
  color?: string;
}

export interface InputNodeData extends BaseNodeData {
  text: string;
}

export interface ResponseNodeData extends BaseNodeData {
  text: string;
  modelId: string;
  status: "pending" | "thinking" | "streaming" | "complete" | "error";
  reasoning?: string;
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
  status?: "pending" | "thinking" | "streaming" | "complete" | "error";
  modelId?: string;
}

export type NodeData = 
  | InputNodeData 
  | ResponseNodeData 
  | DisplayNodeData;

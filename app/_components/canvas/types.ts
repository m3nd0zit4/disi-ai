export interface BaseNodeData {
  id?: string;
  createdAt?: number;
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
}

export interface DisplayNodeData extends BaseNodeData {
  type: "text" | "image" | "video";
  content?: string;
  mediaUrl?: string;
}

export type NodeData = 
  | InputNodeData 
  | ResponseNodeData 
  | DisplayNodeData;

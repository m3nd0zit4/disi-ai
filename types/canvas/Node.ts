import { Provider } from "@/types/ai-models/BaseModel";

export type NodeCategory = 
  | "input"
  | "ai"
  | "tool"
  | "logic"
  | "output";

export interface BaseNodeData extends Record<string, unknown> {
  label?: string;
  isLoading?: boolean;
  error?: string;
}

export interface ChatInputNodeData extends BaseNodeData {
  userInput: string;
  category: "reasoning" | "image" | "video";
  provider?: Provider;
  modelId?: string;
  output?: {
    text?: string;
    mediaUrl?: string;
    error?: string;
    isLoading?: boolean;
  };
}

export interface AIModelNodeData extends BaseNodeData {
  provider: Provider;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  output?: {
    text?: string;
    tokens?: number;
    cost?: number;
    isLoading?: boolean;
  };
}

export interface DisplayNodeData extends BaseNodeData {
  content?: string;
  mediaUrl?: string;
  type: "text" | "image" | "video";
}

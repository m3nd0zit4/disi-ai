import type { RLMMode } from "@/lib/rlm";

/** Inputs for a node execution (prompt, model, options, etc.) */
export interface NodeExecutionInputs {
  prompt?: string;
  text?: string;
  modelId?: string;
  provider?: string;
  systemPrompt?: string;
  temperature?: number;
  context?: Array<unknown>;
  reasoningContext?: unknown;
  imageSize?: string;
  imageQuality?: string;
  imageBackground?: string;
  imageOutputFormat?: string;
  imageN?: number;
  imageModeration?: string;
  videoAspectRatio?: string;
  videoResolution?: string;
  videoDuration?: number;
  query?: string;
  /** RLM options */
  rlmEnabled?: boolean;
  rlmMode?: RLMMode;
  /** Force full RLM (planner → workers → aggregator) regardless of context size */
  rlmForceFull?: boolean;
  /** AI Features (user-controlled, default OFF) */
  webSearchEnabled?: boolean;
  thinkingEnabled?: boolean;
  /** When set, enables the tool loop with these tools from the registry (e.g. ["get_current_time"]). */
  toolNames?: string[];
  /** Max steps for the tool loop when toolNames is set (default 5). */
  maxSteps?: number;
  /** RAG context from Knowledge Base search (injected into prompt when present) */
  kbContext?: Array<{ id?: string; title?: string; content?: string; kbId?: string; score?: number }>;
  /** User RLM settings from Convex (merge with DEFAULT_RLM_CONFIG in worker) */
  rlmSettings?: {
    mode?: RLMMode;
    tokenBudget?: number;
    enableCache?: boolean;
    enableReasoning?: boolean;
    maxDepth?: number;
    maxChildCalls?: number;
  };
}

/** Payload for a node execution message (SQS / Convex queue) */
export interface NodeExecutionPayload {
  executionId: string;
  nodeId: string;
  nodeType: string;
  canvasId: string;
  inputs: NodeExecutionInputs;
  apiKey?: string;
  userId?: string;
}

/** Result returned by execution handlers (image, video, text) */
export interface NodeExecutionResult {
  text: string;
  tokens: number;
  cost: number;
  /** When true, the agent paused for user confirmation (human-in-the-loop). */
  waitingConfirmation?: boolean;
}

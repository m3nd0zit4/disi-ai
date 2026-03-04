import { SemanticRole } from "@/lib/reasoning/types";

export interface BaseNodeData {
  id?: string;
  createdAt?: number;
  color?: string;
  role?: SemanticRole;
  importance?: number;
  executionId?: string;
  status?: "pending" | "thinking" | "streaming" | "complete" | "error" | "uploading" | "searching";
  prompt?: string;
  text?: string;
  /** Live reasoning/thinking from provider (streaming); rendered separately from content */
  thinkingContent?: string;
  /** Progress message for multi-step generation (e.g. "Step 2/3: Researching...") */
  progressMessage?: string;
  /** Tool execution status (processing/completed/error) */
  toolStatus?: "processing" | "completed" | "error";
  /** Name of the tool being executed */
  toolName?: string;
  /** Number of results from tool (e.g. search results count) */
  toolResultsCount?: number;
  /** Input parameters passed to the tool (e.g., { query: "..." }) */
  toolInput?: Record<string, unknown>;
  /** Output/results from the tool (for web search: SearchResult[]) */
  toolOutput?: Array<{
    title: string;
    url: string;
    snippet?: string;
    domain: string;
    favicon?: string;
  }>;
  /** Unique identifier for this tool call */
  toolCallId?: string;
  /** Step labels for tool progress (optional). */
  toolSteps?: string[];
  /** Generative UI: canonical block type for current tool (so client can show skeleton before history update) */
  toolUiType?: string;
  /** Generative UI: props for current tool block */
  toolUiProps?: Record<string, unknown>;
  /** Agentic workflow: current agent state (running, waiting for user confirmation, completed, failed) */
  agentState?: "running" | "waiting_confirmation" | "completed" | "failed";
  /** When agentState === "waiting_confirmation", the tool call pending user approval */
  pendingToolCall?: {
    tool: string;
    args?: Record<string, unknown>;
    callId?: string;
  };
  /** Full history of tool calls in this run (each iteration of the agent loop) */
  toolCallsHistory?: Array<{
    tool: string;
    status: "processing" | "completed" | "error";
    resultsCount?: number;
    error?: string;
    input?: Record<string, unknown>;
    output?: unknown;
    callId?: string;
    steps?: string[];
    /** Generative UI: canonical block type for client component mapping */
    uiType?: string;
    /** Generative UI: props for the block */
    uiProps?: Record<string, unknown>;
  }>;
}


export interface InputNodeData extends BaseNodeData {
  attachments?: { url?: string; storageId?: string; type?: string; name?: string }[];
}

/** Citation from web search results */
export interface Citation {
  url: string;
  title: string;
  description?: string;
  domain?: string;
  favicon?: string;
}

export interface ResponseNodeData extends BaseNodeData {
  modelId: string;
  /** User preference: true = content collapsed, false/undefined = expanded (default) */
  contentCollapsed?: boolean;
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
  /** Web search citations (if web search was used) */
  citations?: Citation[];
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
  progress?: number;
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


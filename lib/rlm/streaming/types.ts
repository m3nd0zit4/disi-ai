/**
 * Shared types for the RLM streaming pipeline.
 * Single format: chunks consumed by StreamProcessor (from AI SDK fullStream via mapAISDKStreamToChunks).
 */

export interface StreamCitation {
  url: string;
  title: string;
  description?: string;
  domain?: string;
  favicon?: string;
}

/** Web search phase for UI step-by-step progress */
export type SearchPhase = "in_progress" | "searching" | "completed";

/** Tool event passed through to StreamProcessor and Generative UI */
export interface NormalizedToolEvent {
  tool: string;
  status: "processing" | "completed" | "error";
  resultsCount?: number;
  error?: string;
  input?: Record<string, unknown>;
  output?: unknown;
}

export interface NormalizedChunk {
  text: string;
  isThinking: boolean;
  isSearching?: boolean;
  searchPhase?: SearchPhase;
  searchQuery?: string;
  tokenCount?: number;
  isComplete: boolean;
  stopReason?: string;
  errorMessage?: string;
  citations?: StreamCitation[];
  toolEvent?: NormalizedToolEvent;
}

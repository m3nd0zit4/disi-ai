/**
 * Types for the Vercel AI SDK adapter.
 * Bridges our internal request/response shape with the AI SDK.
 */

export interface AISDKAdapterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateTextOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Provider-specific: Anthropic/OpenAI web search */
  webSearch?: { enabled: boolean; maxUses?: number };
  /** Provider-specific: thinking / extended reasoning */
  thinking?: { enabled: boolean; budgetTokens?: number };
  reasoning?: { enabled: boolean; effort?: "low" | "medium" | "high" };
  /** Built-in tool slugs to enable (e.g. web_search, google_search, x_search). Resolved per provider/model. */
  builtInTools?: string[];
}

export interface GenerateTextResult {
  content: string;
  tokens: number | { input: number; output: number; total: number };
  finishReason?: string;
  thinkingContent?: string;
  citations?: Array<{ url: string; title: string; description?: string; domain?: string; favicon?: string }>;
}

export type StreamChunkCallback = (chunk: unknown) => void | Promise<void>;

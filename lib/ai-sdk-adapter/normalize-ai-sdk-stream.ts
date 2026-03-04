/**
 * Maps Vercel AI SDK fullStream (TextStreamPart) to NormalizedChunk for the RLM pipeline.
 * Single conversion path: fullStream → mapAISDKStreamToChunks → StreamProcessor.
 * Tool names are normalized to canonical slugs (e.g. web_search) for Generative UI.
 */

import type { NormalizedChunk, NormalizedToolEvent, StreamCitation } from "@/lib/rlm/streaming/types";

/** Map provider-specific tool names to our canonical slugs (used by UI friendlyToolName). */
const TOOL_NAME_ALIASES: Record<string, string> = {
  webSearch: "web_search",
  web_search_preview: "web_search",
  googleSearch: "google_search",
  xSearch: "x_search",
  codeExecution: "code_execution",
  codeInterpreter: "code_interpreter",
  fileSearch: "file_search",
  imageGeneration: "image_generation",
  computerUse: "computer_use",
  collectionsSearch: "collections_search",
  urlContext: "url_context",
  googleMaps: "google_maps",
  enterpriseWebSearch: "enterprise_web_search",
  getWeather: "get_weather",
  geoMap: "geo_map",
  dataTable: "data_table",
};

function normalizeToolName(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "tool";
  const lower = trimmed.toLowerCase();
  if (TOOL_NAME_ALIASES[trimmed]) return TOOL_NAME_ALIASES[trimmed];
  if (TOOL_NAME_ALIASES[lower]) return TOOL_NAME_ALIASES[lower];
  const camelToSnake = trimmed.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  if (TOOL_NAME_ALIASES[camelToSnake]) return TOOL_NAME_ALIASES[camelToSnake];
  return trimmed.includes("_") ? trimmed : camelToSnake || trimmed;
}

export type TextStreamPart = {
  type: string;
  text?: string;
  /** AI SDK v5 UI stream uses `value` for text deltas */
  value?: string;
  id?: string;
  toolName?: string;
  delta?: string;
  url?: string;
  title?: string;
  [key: string]: unknown;
};

/**
 * Maps AI SDK fullStream to an async iterable of NormalizedChunk for StreamProcessor.
 * Use this as the single entry point: fullStream → mapAISDKStreamToChunks(fullStream) → processor.processStream(stream).
 */
export async function* mapAISDKStreamToChunks(
  fullStream: AsyncIterable<TextStreamPart>
): AsyncGenerator<NormalizedChunk, void, unknown> {
  for await (const part of fullStream) {
    const normalized = normalizePart(part as TextStreamPart);
    if (normalized) yield normalized;
  }
}

/** Single-part mapper (for tests or custom consumers). */
export function mapAISDKPartToChunk(part: unknown): NormalizedChunk | null {
  return normalizePart(part as TextStreamPart);
}

function normalizePart(part: TextStreamPart): NormalizedChunk | null {
  switch (part.type) {
    case "text-delta":
      return {
        text: part.text ?? "",
        isThinking: false,
        isComplete: false,
      };

    case "text":
      return {
        text: part.value ?? part.text ?? "",
        isThinking: false,
        isComplete: false,
      };

    case "reasoning-delta":
    case "reasoning":
      return {
        text: part.value ?? part.text ?? "",
        isThinking: true,
        isComplete: false,
      };

    case "reasoning-start":
      return { text: "", isThinking: true, isComplete: false };

    case "reasoning-end":
      return { text: "", isThinking: false, isComplete: false };

    case "tool-input-start": {
      const rawName = part.toolName ?? "tool";
      const toolName = normalizeToolName(rawName);
      const args = (part as { args?: Record<string, unknown> }).args;
      const toolEvent: NormalizedToolEvent = {
        tool: toolName,
        status: "processing",
        ...(args && typeof args === "object" && { input: args }),
      };
      return {
        text: "",
        isThinking: false,
        isSearching: true,
        searchPhase: "in_progress",
        searchQuery: toolName === "web_search" ? (part as { query?: string }).query : undefined,
        isComplete: false,
        toolEvent,
      };
    }

    case "tool-result":
    case "tool-input-end": {
      const citations = extractCitationsFromToolResult(part);
      const rawToolName = (part as { toolName?: string }).toolName ?? "tool";
      const toolName = normalizeToolName(rawToolName);
      const result = (part as { result?: unknown; output?: unknown; content?: unknown }).result
        ?? (part as { output?: unknown }).output
        ?? (part as { content?: unknown }).content;
      const toolEvent: NormalizedToolEvent = {
        tool: toolName,
        status: "completed",
        ...(citations.length > 0 && { resultsCount: citations.length }),
        ...(result !== undefined && result !== null && { output: result }),
      };
      return {
        text: "",
        isThinking: false,
        isSearching: false,
        searchPhase: "completed",
        isComplete: false,
        toolEvent,
        ...(citations.length > 0 && { citations }),
      };
    }

    case "source": {
      const cit = sourceToCitation(part);
      if (cit)
        return {
          text: "",
          isThinking: false,
          isSearching: false,
          isComplete: false,
          citations: [cit],
        };
      return null;
    }

    case "finish-step": {
      const usage = (part as { usage?: { totalTokens?: number; promptTokens?: number; completionTokens?: number } }).usage;
      const total =
        usage?.totalTokens ??
        (typeof usage?.promptTokens === "number" && typeof usage?.completionTokens === "number"
          ? usage.promptTokens + usage.completionTokens
          : undefined);
      return {
        text: "",
        isThinking: false,
        isComplete: false,
        tokenCount: total,
      };
    }

    case "finish": {
      const totalUsage = (part as { totalUsage?: { totalTokens?: number; promptTokens?: number; completionTokens?: number } }).totalUsage;
      const total =
        totalUsage?.totalTokens ??
        (typeof totalUsage?.promptTokens === "number" && typeof totalUsage?.completionTokens === "number"
          ? totalUsage.promptTokens + totalUsage.completionTokens
          : undefined);
      return {
        text: "",
        isThinking: false,
        isComplete: true,
        stopReason: (part as { finishReason?: string }).finishReason ?? "stop",
        tokenCount: total,
      };
    }

    case "tool-error": {
      const toolName = normalizeToolName((part as { toolName?: string }).toolName ?? "tool");
      const err = (part as { error?: unknown }).error;
      const toolEvent: NormalizedToolEvent = {
        tool: toolName,
        status: "error",
        error: err != null ? String(err) : undefined,
      };
      return { text: "", isThinking: false, isComplete: false, toolEvent };
    }

    case "error": {
      const err = (part as { error?: unknown; message?: string }).error ?? (part as { message?: string }).message;
      const errorMessage =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Model stream ended with an error.";
      return {
        text: "",
        isThinking: false,
        isComplete: true,
        stopReason: "error",
        errorMessage,
      };
    }

    default:
      return null;
  }
}

function extractCitationsFromToolResult(part: TextStreamPart): StreamCitation[] {
  const result = part.result ?? part.output ?? part.content;
  if (!result || typeof result !== "object") return [];
  const arr = Array.isArray(result) ? result : (result as { sources?: unknown[] }).sources;
  if (!Array.isArray(arr)) return [];
  const citations: StreamCitation[] = [];
  for (const item of arr) {
    const o = item as Record<string, unknown>;
    if (o.url) {
      citations.push({
        url: String(o.url),
        title: String(o.title ?? o.name ?? ""),
        description: o.description ? String(o.description) : undefined,
        domain: o.domain ? String(o.domain) : undefined,
        favicon: o.favicon ? String(o.favicon) : undefined,
      });
    }
  }
  return citations;
}

function sourceToCitation(part: TextStreamPart): StreamCitation | null {
  const url = part.url ?? (part as { source?: { url?: string } }).source?.url;
  if (!url) return null;
  return {
    url: String(url),
    title: String(part.title ?? (part as { source?: { title?: string } }).source?.title ?? ""),
    description: part.description ? String(part.description) : undefined,
    domain: part.domain ? String(part.domain) : undefined,
    favicon: part.favicon ? String(part.favicon) : undefined,
  };
}

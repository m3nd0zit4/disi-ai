/**
 * Stream processor: consumes a stream of NormalizedChunk (from mapAISDKStreamToChunks),
 * handles batching, status updates, tool events, and content buffering for Generative UI.
 */

import { deriveUIFromToolEvent } from "@/lib/agent/ui-types";
import {
  StreamStatus,
  StreamChunkCallback,
  StreamStatusCallback,
  StreamingOptions,
  DEFAULT_STREAMING_OPTIONS,
  ToolEvent,
  SearchResult,
} from "../types";
import type { NormalizedChunk, StreamCitation, SearchPhase } from "./types";

export type { NormalizedChunk, StreamCitation } from "./types";

const SEARCH_TOOLS = new Set(["web_search", "google_search", "x_search", "enterprise_web_search"]);

function isSearchTool(toolName?: string): boolean {
  return !!(toolName && SEARCH_TOOLS.has(toolName));
}

function getStepsForSearchPhase(phase?: SearchPhase): string[] {
  switch (phase) {
    case "searching":
      return ["Haciendo la magia en la web...", "Leyendo los mejores resultados..."];
    case "completed":
      return [
        "Haciendo la magia en la web...",
        "Leyendo los mejores resultados...",
        "Conectando los puntos...",
      ];
    case "in_progress":
    default:
      return ["Consultando oráculos digitales..."];
  }
}

export interface StreamProcessorConfig {
  onChunk?: StreamChunkCallback;
  onStatus?: StreamStatusCallback;
  streamingOptions?: StreamingOptions;
}

export class StreamProcessor {
  private currentText = "";
  private thinkingText = "";
  private citations: StreamCitation[] = [];
  private tokensUsed = 0;
  /** Accumulated token count across all steps (finish-step + finish) so multi-step tool calls are fully charged */
  private accumulatedTokens = 0;
  private lastUpdateTime = 0;
  private pendingBatch = "";
  private options: StreamingOptions;
  private onChunk?: StreamChunkCallback;
  private onStatus?: StreamStatusCallback;

  constructor(config: StreamProcessorConfig) {
    this.options = { ...DEFAULT_STREAMING_OPTIONS, ...config.streamingOptions };
    this.onChunk = config.onChunk;
    this.onStatus = config.onStatus;
  }

  async processStream(
    stream: AsyncIterable<NormalizedChunk>
  ): Promise<{ text: string; thinkingText: string; tokensUsed: number; citations?: StreamCitation[] }> {
    await this.emitStatus("thinking");

    let hasStartedStreaming = false;
    let isCurrentlySearching = false;
    let currentSearchQuery: string | undefined;
    let contentBuffer = "";

    for await (const chunk of stream) {
      if (chunk.stopReason === "error") {
        throw new Error(chunk.errorMessage ?? "Model stream ended with an error.");
      }
      if (chunk.citations?.length) {
        this.citations.push(...chunk.citations);
        console.log("[StreamProcessor] Accumulated", this.citations.length, "citations");
      }

      if (chunk.toolEvent) {
        await this.emitStatus("searching", false, chunk.toolEvent as ToolEvent);
      }

      // Only treat as "search in progress" (buffer + search steps) for actual search tools
      if (chunk.isSearching === true && isSearchTool(chunk.toolEvent?.tool)) {
        if (!isCurrentlySearching) {
          isCurrentlySearching = true;
          if (chunk.searchQuery) currentSearchQuery = chunk.searchQuery;
          console.log("[StreamProcessor] Web search started");
        }
        const stepsForPhase = getStepsForSearchPhase(chunk.searchPhase);
        await this.emitStatus("searching", false, {
          tool: chunk.toolEvent?.tool ?? "web_search",
          status: "processing",
          steps: stepsForPhase,
          ...(currentSearchQuery && { input: { query: currentSearchQuery } }),
        });
      } else if (chunk.isSearching === false && isCurrentlySearching) {
        isCurrentlySearching = false;
        const searchToolName = chunk.toolEvent?.tool ?? "web_search";
        console.log("[StreamProcessor] Web search completed, citations:", this.citations.length);

        const searchResults: SearchResult[] = this.citations.map((cit) => ({
          title: cit.title,
          url: cit.url,
          snippet: cit.description,
          domain: cit.domain ?? "",
          favicon: cit.favicon,
        }));

        await this.emitStatus("searching", false, {
          tool: searchToolName,
          status: "completed",
          resultsCount: this.citations.length,
          output: searchResults,
          steps: [
            "Haciendo la magia en la web...",
            `${this.citations.length} ${this.citations.length === 1 ? "fuente encontrada" : "fuentes encontradas"}`,
            "Extrayendo lo mejor y resumiendo para ti...",
          ],
          ...(currentSearchQuery && { input: { query: currentSearchQuery } }),
        });

        if (contentBuffer.length > 0) {
          const flushChunkSize = 28;
          for (let i = 0; i < contentBuffer.length; i += flushChunkSize) {
            const chunk = contentBuffer.slice(i, i + flushChunkSize);
            this.currentText += chunk;
            this.pendingBatch += chunk;
            if (this.onChunk) await this.onChunk(chunk);
            await this.emitStatus("streaming");
          }
          contentBuffer = "";
        }
        if (!hasStartedStreaming) {
          hasStartedStreaming = true;
          await this.emitStatus("streaming");
        }
      }

      if (!hasStartedStreaming && chunk.text && !chunk.isThinking && !isCurrentlySearching) {
        hasStartedStreaming = true;
        await this.emitStatus("streaming");
      }

      if (chunk.isThinking) {
        this.thinkingText += chunk.text;
        // Emit thinking status so Convex gets reasoning in real time (no "black hole" of 10s spinner)
        await this.emitStatus("thinking");
      } else if (chunk.text) {
        if (isCurrentlySearching) {
          contentBuffer += chunk.text;
        } else {
          this.currentText += chunk.text;
          this.pendingBatch += chunk.text;
        }
      }

      if (typeof chunk.tokenCount === "number" && chunk.tokenCount >= 0) {
        this.tokensUsed = chunk.tokenCount;
        if (chunk.isComplete) {
          this.accumulatedTokens = chunk.tokenCount;
        } else {
          this.accumulatedTokens += chunk.tokenCount;
        }
      }

      if (this.onChunk && chunk.text && !chunk.isThinking && !isCurrentlySearching) {
        await this.onChunk(chunk.text);
      }

      await this.maybeEmitStatusUpdate();
      // Do not break on isComplete: Claude yields citations_extracted after message_stop,
      // so we must consume the full stream to show tool completion and all text.
    }

    if (contentBuffer.length > 0) {
      const flushChunkSize = 28;
      for (let i = 0; i < contentBuffer.length; i += flushChunkSize) {
        const chunk = contentBuffer.slice(i, i + flushChunkSize);
        this.currentText += chunk;
        this.pendingBatch += chunk;
        if (this.onChunk) await this.onChunk(chunk);
        await this.emitStatus("streaming");
      }
      if (!hasStartedStreaming) {
        hasStartedStreaming = true;
        await this.emitStatus("streaming");
      }
    }

    // Flush any remaining batch so the full response is sent before "complete"
    await this.maybeEmitStatusUpdate();
    await this.emitStatus("complete", true);
    console.log("[StreamProcessor] Stream complete. Citations:", this.citations.length);

    const finalTokens =
      this.accumulatedTokens > 0 ? this.accumulatedTokens : this.tokensUsed || Math.ceil(this.currentText.length / 4);
    return {
      text: this.currentText,
      thinkingText: this.thinkingText,
      tokensUsed: finalTokens,
      citations: this.citations.length > 0 ? this.citations : undefined,
    };
  }

  private async maybeEmitStatusUpdate() {
    const now = Date.now();
    const shouldUpdate =
      this.pendingBatch.length >= (this.options.batchSize ?? 50) ||
      now - this.lastUpdateTime >= (this.options.updateInterval ?? 100);
    if (shouldUpdate && this.onStatus) {
      await this.emitStatus("streaming");
      this.pendingBatch = "";
      this.lastUpdateTime = now;
    }
  }

  private async emitStatus(phase: StreamStatus["phase"], isFinal = false, toolEvent?: ToolEvent) {
    if (!this.onStatus) return;
    let enrichedToolEvent = toolEvent;
    if (toolEvent) {
      const ui = deriveUIFromToolEvent({
        tool: toolEvent.tool,
        input: toolEvent.input,
        output: toolEvent.output,
        resultsCount: toolEvent.resultsCount,
        steps: toolEvent.steps,
      });
      if (ui) {
        enrichedToolEvent = { ...toolEvent, uiType: ui.uiType, uiProps: ui.uiProps as Record<string, unknown> };
      }
    }
    await this.onStatus({
      phase,
      currentText: this.currentText,
      thinkingContent: this.thinkingText || undefined,
      tokensUsed: this.tokensUsed || Math.ceil(this.currentText.length / 4),
      isFinal,
      ...(enrichedToolEvent && { toolEvent: enrichedToolEvent }),
    });
  }
}

/**
 * Stream Normalizer - Unifies streaming output from all AI providers
 *
 * Handles:
 * - OpenAI format: chunk.choices[0].delta.content
 * - Anthropic format: content_block_delta events with text_delta
 * - Google/Gemini format: chunk.text()
 * - xAI/Grok format: Same as OpenAI
 * - DeepSeek format: Same as OpenAI
 *
 * Also handles reasoning/thinking extraction for Claude extended thinking
 */

import { StreamStatus, StreamChunkCallback, StreamStatusCallback, StreamingOptions, DEFAULT_STREAMING_OPTIONS } from "./types";

export interface NormalizedChunk {
  /** The text content of this chunk */
  text: string;
  /** Whether this is thinking/reasoning content (Claude extended thinking) */
  isThinking: boolean;
  /** Token count if available */
  tokenCount?: number;
  /** Whether this is the final chunk */
  isComplete: boolean;
  /** Stop reason if complete */
  stopReason?: string;
}

export interface StreamNormalizerConfig {
  provider: string;
  onChunk?: StreamChunkCallback;
  onStatus?: StreamStatusCallback;
  streamingOptions?: StreamingOptions;
}

/**
 * Creates a normalized async generator from any provider's stream
 */
export async function* normalizeStream(
  rawStream: AsyncIterable<unknown>,
  provider: string
): AsyncGenerator<NormalizedChunk, void, unknown> {
  const providerLower = provider.toLowerCase();

  for await (const chunk of rawStream) {
    const normalized = normalizeChunk(chunk, providerLower);
    if (normalized) {
      yield normalized;
    }
  }
}

/**
 * Normalize a single chunk based on provider format
 */
function normalizeChunk(chunk: unknown, provider: string): NormalizedChunk | null {
  try {
    switch (provider) {
      case "openai":
      case "gpt":
      case "xai":
      case "grok":
      case "deepseek": {
        // OpenAI-compatible format
        const c = chunk as {
          choices?: Array<{
            delta?: { content?: string; reasoning_content?: string };
            finish_reason?: string;
          }>;
        };

        const delta = c.choices?.[0]?.delta;
        const text = delta?.content || "";
        const thinkingText = delta?.reasoning_content || "";
        const finishReason = c.choices?.[0]?.finish_reason;

        // Handle thinking content separately (DeepSeek R1)
        if (thinkingText) {
          return {
            text: thinkingText,
            isThinking: true,
            isComplete: false,
          };
        }

        if (text || finishReason) {
          return {
            text,
            isThinking: false,
            isComplete: !!finishReason,
            stopReason: finishReason || undefined,
          };
        }
        return null;
      }

      case "anthropic":
      case "claude": {
        // Anthropic format with event types
        // Handles both regular streaming and extended thinking (Claude 3.5+)
        const c = chunk as {
          type?: string;
          index?: number;
          delta?: { type?: string; text?: string; thinking?: string };
          content_block?: { type?: string; text?: string; thinking?: string };
          message?: { usage?: { output_tokens?: number } };
          usage?: { output_tokens?: number };
        };

        // Regular text delta
        if (c.type === "content_block_delta" && c.delta?.type === "text_delta") {
          return {
            text: c.delta.text || "",
            isThinking: false,
            isComplete: false,
          };
        }

        // Extended thinking delta (Claude 3.5+ with extended thinking enabled)
        if (c.type === "content_block_delta" && c.delta?.type === "thinking_delta") {
          return {
            text: c.delta.thinking || "",
            isThinking: true,
            isComplete: false,
          };
        }

        // Content block start - track if it's a thinking block
        if (c.type === "content_block_start") {
          const blockType = c.content_block?.type;
          if (blockType === "thinking") {
            // Mark as thinking block started
            return {
              text: "",
              isThinking: true,
              isComplete: false,
            };
          }
        }

        // Message stop event
        if (c.type === "message_stop") {
          return {
            text: "",
            isThinking: false,
            isComplete: true,
            stopReason: "end_turn",
          };
        }

        // Message delta with usage info (final stats)
        if (c.type === "message_delta") {
          const usage = c.usage;
          return {
            text: "",
            isThinking: false,
            isComplete: true,
            tokenCount: usage?.output_tokens,
            stopReason: "end_turn",
          };
        }

        return null;
      }

      case "google":
      case "gemini": {
        // Gemini format with .text() method
        const c = chunk as { text?: () => string; candidates?: Array<{ finishReason?: string }> };

        const text = typeof c.text === "function" ? c.text() : "";
        const finishReason = c.candidates?.[0]?.finishReason;

        if (text || finishReason) {
          return {
            text,
            isThinking: false,
            isComplete: !!finishReason && finishReason !== "STOP",
            stopReason: finishReason || undefined,
          };
        }
        return null;
      }

      default:
        console.warn(`[StreamNormalizer] Unknown provider: ${provider}, attempting OpenAI format`);
        // Fallback to OpenAI format
        const c = chunk as { choices?: Array<{ delta?: { content?: string }; finish_reason?: string }> };
        const text = c.choices?.[0]?.delta?.content || "";
        return text ? { text, isThinking: false, isComplete: false } : null;
    }
  } catch (error) {
    console.error("[StreamNormalizer] Error normalizing chunk:", error);
    return null;
  }
}

/**
 * Stream processor that handles batching and status updates
 */
export class StreamProcessor {
  private currentText = "";
  private thinkingText = "";
  private tokensUsed = 0;
  private lastUpdateTime = 0;
  private pendingBatch = "";
  private options: StreamingOptions;
  private onChunk?: StreamChunkCallback;
  private onStatus?: StreamStatusCallback;

  constructor(config: StreamNormalizerConfig) {
    this.options = { ...DEFAULT_STREAMING_OPTIONS, ...config.streamingOptions };
    this.onChunk = config.onChunk;
    this.onStatus = config.onStatus;
  }

  /**
   * Process the entire stream and return the complete result
   */
  async processStream(
    rawStream: AsyncIterable<unknown>,
    provider: string
  ): Promise<{ text: string; thinkingText: string; tokensUsed: number }> {
    // Emit initial "thinking" status
    await this.emitStatus("thinking");

    let hasStartedStreaming = false;

    for await (const chunk of normalizeStream(rawStream, provider)) {
      // First content chunk switches to "streaming" status
      if (!hasStartedStreaming && chunk.text) {
        hasStartedStreaming = true;
        await this.emitStatus("streaming");
      }

      // Accumulate text
      if (chunk.isThinking) {
        this.thinkingText += chunk.text;
      } else {
        this.currentText += chunk.text;
        this.pendingBatch += chunk.text;
      }

      // Update token count if available
      if (chunk.tokenCount) {
        this.tokensUsed = chunk.tokenCount;
      }

      // Call chunk callback immediately if provided
      if (this.onChunk && chunk.text && !chunk.isThinking) {
        await this.onChunk(chunk.text);
      }

      // Batch status updates for performance
      await this.maybeEmitStatusUpdate();

      // Handle completion
      if (chunk.isComplete) {
        break;
      }
    }

    // Final status update
    await this.emitStatus("complete", true);

    return {
      text: this.currentText,
      thinkingText: this.thinkingText,
      tokensUsed: this.tokensUsed || Math.ceil(this.currentText.length / 4),
    };
  }

  private async maybeEmitStatusUpdate() {
    const now = Date.now();
    const shouldUpdate =
      this.pendingBatch.length >= (this.options.batchSize || 50) ||
      now - this.lastUpdateTime >= (this.options.updateInterval || 100);

    if (shouldUpdate && this.onStatus) {
      await this.emitStatus("streaming");
      this.pendingBatch = "";
      this.lastUpdateTime = now;
    }
  }

  private async emitStatus(phase: StreamStatus["phase"], isFinal = false) {
    if (!this.onStatus) return;

    const status: StreamStatus = {
      phase,
      currentText: this.currentText,
      thinkingContent: this.thinkingText || undefined,
      tokensUsed: this.tokensUsed || Math.ceil(this.currentText.length / 4),
      isFinal,
    };

    await this.onStatus(status);
  }
}

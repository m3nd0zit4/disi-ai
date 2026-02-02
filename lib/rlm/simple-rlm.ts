/**
 * Simple RLM - Single-depth execution without sub-calls
 *
 * For easy/straightforward queries that don't require recursive decomposition.
 * - Distills context
 * - Makes single LLM call (with optional streaming)
 * - Returns structured output
 */

import { ReasoningContext } from "@/lib/reasoning/types";
import { distillContext } from "@/lib/reasoning/distillation";
import { buildReasoningPrompt } from "@/lib/reasoning/prompt";
import { getAIService } from "@/lib/aiServices";
import { RLMConfig, RLMOutput, RLMExecutionState, DEFAULT_RLM_CONFIG, StreamingOptions, DEFAULT_STREAMING_OPTIONS, StreamStatus } from "./types";
import { BudgetManager } from "./budget";
import { resolveModelId, getApiKeyForProvider, normalizeProvider } from "./model-resolver";
import { StreamProcessor } from "./stream-normalizer";

export interface SimpleRLMOptions {
  config?: Partial<RLMConfig>;
  systemPrompt?: string;
  apiKey?: string;
  /** Streaming options for real-time updates */
  streaming?: StreamingOptions;
}

/**
 * Execute Simple RLM - single LLM call, no recursion
 */
export async function executeSimpleRLM(
  query: string,
  context: ReasoningContext,
  options: SimpleRLMOptions = {}
): Promise<RLMOutput> {
  const config = { ...DEFAULT_RLM_CONFIG, ...options.config, mode: "simple" as const };
  const budget = new BudgetManager(config.tokenBudget);

  const state: RLMExecutionState = {
    depth: 0,
    childCallCount: 0,
    tokensUsed: 0,
    cacheHits: 0,
    stoppedEarly: false,
  };

  // DEBUG: Log initial config
  console.log("[SimpleRLM] Starting execution with config:", {
    modelId: config.modelId,
    provider: config.provider,
    tokenBudget: config.tokenBudget,
    hasApiKeyInOptions: !!options.apiKey,
  });

  try {
    // 1. Distill context to fit budget
    const contextBudget = Math.floor(config.tokenBudget * 0.7); // Reserve 30% for response
    const distilledContext = distillContext(context, { maxTokens: contextBudget });

    console.log("[SimpleRLM] Context distilled:", {
      originalItems: context.items.length,
      distilledItems: distilledContext.items.length,
      distilledTokens: distilledContext.totalTokens,
    });

    // 2. Build prompt
    const messages = buildReasoningPrompt(
      options.systemPrompt,
      distilledContext,
      query
    );

    console.log("[SimpleRLM] Messages built:", {
      messageCount: messages.length,
      queryLength: query.length,
    });

    // 3. Call LLM - resolve all values before calling
    const normalizedProvider = normalizeProvider(config.provider);
    const resolvedModelId = resolveModelId(config.modelId);
    const resolvedApiKey = getApiKeyForProvider(config.provider, options.apiKey);

    console.log("[SimpleRLM] Resolved values:", {
      originalProvider: config.provider,
      normalizedProvider,
      originalModelId: config.modelId,
      resolvedModelId,
      hasApiKey: !!resolvedApiKey,
      apiKeyLength: resolvedApiKey?.length || 0,
      apiKeyPrefix: resolvedApiKey ? resolvedApiKey.substring(0, 10) + "..." : "NONE",
    });

    const service = getAIService(normalizedProvider, resolvedApiKey);

    console.log("[SimpleRLM] Calling AI service...", {
      model: resolvedModelId,
      provider: normalizedProvider,
    });

    const response = await service.generateResponse({
      model: resolvedModelId,
      messages: messages as Array<{ role: string; content: string }>,
      temperature: 0.7,
    });

    console.log("[SimpleRLM] Response received:", {
      contentLength: response.content?.length || 0,
      tokens: response.tokens,
    });

    // 4. Update state
    state.tokensUsed = response.tokens;
    budget.consume(response.tokens);

    // 5. Build output
    const output: RLMOutput = {
      content: {
        markdown: response.content,
      },
      metadata: {
        mode: "simple",
        depthUsed: 0,
        subCalls: 0,
        cacheHits: 0,
        tokensUsed: state.tokensUsed,
      },
    };

    // 6. Add reasoning if enabled
    if (config.enableReasoning) {
      output.reasoning = {
        summary: "Direct response generated using distilled context (Simple RLM mode).",
        type: "proxy",
      };
    }

    return output;

  } catch (error) {
    // DEBUG: Log the full error details
    console.error("[SimpleRLM] ERROR CAUGHT:", {
      errorType: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      config: {
        modelId: config.modelId,
        provider: config.provider,
      },
    });

    // If it's an API error, try to extract more details
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      if (err.status) console.error("[SimpleRLM] API Status:", err.status);
      if (err.statusText) console.error("[SimpleRLM] API StatusText:", err.statusText);
      if (err.response) console.error("[SimpleRLM] API Response:", err.response);
      if (err.body) console.error("[SimpleRLM] API Body:", err.body);
      if (err.error) console.error("[SimpleRLM] API Error Details:", err.error);
    }

    // Return error as structured output
    return {
      content: {
        markdown: `**Error during Simple RLM execution:**\n\n${error instanceof Error ? error.message : String(error)}`,
      },
      reasoning: config.enableReasoning ? {
        summary: "Execution failed with an error.",
        type: "proxy",
      } : undefined,
      metadata: {
        mode: "simple",
        depthUsed: 0,
        subCalls: 0,
        cacheHits: 0,
        tokensUsed: state.tokensUsed,
      },
    };
  }
}

/**
 * Execute Simple RLM with streaming support
 *
 * This version streams responses in real-time via callbacks,
 * providing a more responsive user experience.
 */
export async function executeSimpleRLMStreaming(
  query: string,
  context: ReasoningContext,
  options: SimpleRLMOptions = {}
): Promise<RLMOutput> {
  const config = { ...DEFAULT_RLM_CONFIG, ...options.config, mode: "simple" as const };
  const streamingOpts = { ...DEFAULT_STREAMING_OPTIONS, ...options.streaming };
  const budget = new BudgetManager(config.tokenBudget);

  const state: RLMExecutionState = {
    depth: 0,
    childCallCount: 0,
    tokensUsed: 0,
    cacheHits: 0,
    stoppedEarly: false,
  };

  console.log("[SimpleRLM-Streaming] Starting streaming execution:", {
    modelId: config.modelId,
    provider: config.provider,
    streamingEnabled: streamingOpts.enabled,
  });

  // Emit initial thinking status
  if (streamingOpts.onStatus) {
    await streamingOpts.onStatus({
      phase: "thinking",
      currentText: "",
      tokensUsed: 0,
      isFinal: false,
    });
  }

  try {
    // 1. Distill context to fit budget
    const contextBudget = Math.floor(config.tokenBudget * 0.7);
    const distilledContext = distillContext(context, { maxTokens: contextBudget });

    console.log("[SimpleRLM-Streaming] Context distilled:", {
      originalItems: context.items.length,
      distilledItems: distilledContext.items.length,
    });

    // 2. Build prompt
    const messages = buildReasoningPrompt(options.systemPrompt, distilledContext, query);

    // 3. Resolve provider and model
    const normalizedProvider = normalizeProvider(config.provider);
    const resolvedModelId = resolveModelId(config.modelId);
    const resolvedApiKey = getApiKeyForProvider(config.provider, options.apiKey);

    console.log("[SimpleRLM-Streaming] Resolved:", {
      provider: normalizedProvider,
      modelId: resolvedModelId,
      hasApiKey: !!resolvedApiKey,
    });

    const service = getAIService(normalizedProvider, resolvedApiKey);

    // 4. Get stream from service
    const stream = await service.generateStreamResponse({
      model: resolvedModelId,
      messages: messages as Array<{ role: string; content: string }>,
      temperature: 0.7,
    });

    // 5. Process stream with normalizer
    const processor = new StreamProcessor({
      provider: normalizedProvider,
      onChunk: streamingOpts.onChunk,
      onStatus: streamingOpts.onStatus,
      streamingOptions: streamingOpts,
    });

    const result = await processor.processStream(stream, normalizedProvider);

    console.log("[SimpleRLM-Streaming] Stream complete:", {
      textLength: result.text.length,
      thinkingLength: result.thinkingText.length,
      tokens: result.tokensUsed,
    });

    // 6. Update state and build output
    state.tokensUsed = result.tokensUsed;
    budget.consume(result.tokensUsed);

    const output: RLMOutput = {
      content: {
        markdown: result.text,
      },
      metadata: {
        mode: "simple",
        depthUsed: 0,
        subCalls: 0,
        cacheHits: 0,
        tokensUsed: state.tokensUsed,
      },
    };

    // Add reasoning if we have thinking content
    if (result.thinkingText || config.enableReasoning) {
      output.reasoning = {
        summary: result.thinkingText || "Direct response generated using distilled context (Simple RLM mode).",
        type: result.thinkingText ? "model" : "proxy",
      };
    }

    return output;

  } catch (error) {
    console.error("[SimpleRLM-Streaming] Error:", error);

    // Emit error status
    if (streamingOpts.onStatus) {
      await streamingOpts.onStatus({
        phase: "error",
        currentText: "",
        tokensUsed: state.tokensUsed,
        isFinal: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      content: {
        markdown: `**Error during Simple RLM execution:**\n\n${error instanceof Error ? error.message : String(error)}`,
      },
      reasoning: config.enableReasoning ? {
        summary: "Execution failed with an error.",
        type: "proxy",
      } : undefined,
      metadata: {
        mode: "simple",
        depthUsed: 0,
        subCalls: 0,
        cacheHits: 0,
        tokensUsed: state.tokensUsed,
      },
    };
  }
}

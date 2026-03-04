/**
 * Simple RLM - Single-depth execution without sub-calls.
 */

import { ReasoningContext } from "@/lib/reasoning/types";
import { distillContext } from "@/lib/reasoning/distillation";
import { buildReasoningPrompt, buildEnhancedReasoningPrompt } from "@/lib/reasoning/prompt";
import { generateTextWithAISDK, streamTextWithAISDK, mapAISDKStreamToChunks } from "@/lib/ai-sdk-adapter";
import { getOptimalConfig } from "@/lib/aiServices/configs/provider-configs";
import {
  RLMConfig,
  RLMOutput,
  RLMExecutionState,
  DEFAULT_RLM_CONFIG,
  StreamingOptions,
  DEFAULT_STREAMING_OPTIONS,
  StreamStatus,
} from "../types";
import { BudgetManager, resolveModelId, getApiKeyForProvider, normalizeProvider } from "../internal";
import { StreamProcessor } from "../streaming";

export interface SimpleRLMOptions {
  config?: Partial<RLMConfig>;
  systemPrompt?: string;
  apiKey?: string;
  streaming?: StreamingOptions;
  webSearchEnabled?: boolean;
  thinkingEnabled?: boolean;
  /** When set, enables the tool loop (maxSteps) with these tools from the registry. */
  toolNames?: string[];
  /** Max steps for the tool loop when toolNames is set (default 5). */
  maxSteps?: number;
  /** Built-in tool slugs to enable per provider (e.g. web_search, google_search). Resolved by handler from capability matrix. */
  builtInTools?: string[];
}

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

  try {
    const contextBudget = Math.floor(config.tokenBudget * 0.7);
    const distilledContext = distillContext(context, { maxTokens: contextBudget });
    const messages = buildReasoningPrompt(options.systemPrompt, distilledContext, query);

    const normalizedProvider = normalizeProvider(config.provider);
    const resolvedModelId = resolveModelId(config.modelId);
    const resolvedApiKey = getApiKeyForProvider(config.provider, options.apiKey);

    const response = await generateTextWithAISDK(
      normalizedProvider,
      resolvedModelId,
      resolvedApiKey,
      messages as Array<{ role: "system" | "user" | "assistant"; content: string }>,
      { temperature: 0.7 }
    );

    state.tokensUsed = typeof response.tokens === "number" ? response.tokens : response.tokens.total;
    budget.consume(response.tokens);

    const output: RLMOutput = {
      content: { markdown: response.content },
      metadata: {
        mode: "simple",
        depthUsed: 0,
        subCalls: 0,
        cacheHits: 0,
        tokensUsed: state.tokensUsed,
      },
    };
    if (config.enableReasoning) {
      output.reasoning = {
        summary: "Direct response generated using distilled context (Simple RLM mode).",
        type: "proxy",
      };
    }
    if (response.citations?.length) {
      output.citations = response.citations.map((c) => ({ url: c.url, title: c.title ?? "" }));
    }
    return output;
  } catch (error) {
    console.error("[SimpleRLM] ERROR:", error);
    return {
      content: {
        markdown: `**Error during Simple RLM execution:**\n\n${error instanceof Error ? error.message : String(error)}`,
      },
      reasoning: config.enableReasoning
        ? { summary: "Execution failed with an error.", type: "proxy" }
        : undefined,
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

  if (streamingOpts.onStatus) {
    await streamingOpts.onStatus({
      phase: "thinking",
      currentText: "",
      tokensUsed: 0,
      isFinal: false,
    });
  }

  try {
    const contextBudget = Math.floor(config.tokenBudget * 0.7);
    const distilledContext = distillContext(context, { maxTokens: contextBudget });
    const messages = buildEnhancedReasoningPrompt({
      systemPrompt: options.systemPrompt,
      context: distilledContext,
      userInput: query,
      webSearchEnabled: options.webSearchEnabled ?? false,
      thinkingEnabled: options.thinkingEnabled ?? false,
      autoDetectTaskType: true,
      toolsEnabled: !!(options.toolNames?.length || options.builtInTools?.length),
    });

    const normalizedProvider = normalizeProvider(config.provider);
    const resolvedModelId = resolveModelId(config.modelId);
    const resolvedApiKey = getApiKeyForProvider(config.provider, options.apiKey);
    const optimalConfig = getOptimalConfig(normalizedProvider, resolvedModelId);

    if (!(query ?? "").trim()) {
      throw new Error("El mensaje no puede estar vacío.");
    }
    if (!resolvedApiKey?.trim()) {
      throw new Error(
        "No se encontró API key para el proveedor. Configura la variable de entorno correspondiente (ej. ANTHROPIC_API_KEY) o pásala en la solicitud."
      );
    }

    const maxTokens = config.maxTokens || optimalConfig?.maxTokens || 8000;
    const { fullStream } = await streamTextWithAISDK(
      normalizedProvider,
      resolvedModelId,
      resolvedApiKey,
      messages as Array<{ role: "system" | "user" | "assistant"; content: string }>,
      {
        temperature: 0.7,
        maxTokens,
        webSearch: options.webSearchEnabled ? { enabled: true, maxUses: 3 } : undefined,
        thinking: options.thinkingEnabled ? { enabled: true, budgetTokens: 5000 } : undefined,
        toolNames: options.toolNames,
        maxSteps: options.maxSteps ?? 5,
        builtInTools: options.builtInTools,
      }
    );

    const processor = new StreamProcessor({
      onChunk: streamingOpts.onChunk,
      onStatus: streamingOpts.onStatus,
      streamingOptions: streamingOpts,
    });
    let result = await processor.processStream(mapAISDKStreamToChunks(fullStream));

    if (!result.text?.trim()) {
      const fallbackText =
        result.thinkingText?.trim() ||
        "El modelo no devolvió texto. Comprueba la API key y el modelo, o intenta de nuevo.";
      result = { ...result, text: fallbackText };
    }

    state.tokensUsed = result.tokensUsed;
    budget.consume(result.tokensUsed);

    const output: RLMOutput = {
      content: { markdown: result.text },
      metadata: {
        mode: "simple",
        depthUsed: 0,
        subCalls: 0,
        cacheHits: 0,
        tokensUsed: state.tokensUsed,
      },
    };
    if (result.thinkingText || config.enableReasoning) {
      output.reasoning = {
        summary:
          result.thinkingText ||
          "Direct response generated using distilled context (Simple RLM mode).",
        type: result.thinkingText ? "model" : "proxy",
      };
    }
    if (result.citations?.length) output.citations = result.citations;
    return output;
  } catch (error) {
    console.error("[SimpleRLM-Streaming] Error:", error);
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
      reasoning: config.enableReasoning
        ? { summary: "Execution failed with an error.", type: "proxy" }
        : undefined,
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

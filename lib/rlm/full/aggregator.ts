/**
 * RLM Aggregator - Combines worker results into final markdown output.
 */

import { generateTextWithAISDK, streamTextWithAISDK, mapAISDKStreamToChunks } from "@/lib/ai-sdk-adapter";
import { getOptimalConfig } from "@/lib/aiServices/configs/provider-configs";
import {
  WorkerResult,
  RLMConfig,
  RLMOutput,
  StreamingOptions,
  DEFAULT_STREAMING_OPTIONS,
  TokenUsageBreakdown,
} from "../types";
import { resolveModelId, getApiKeyForProvider, normalizeProvider } from "../internal";
import { StreamProcessor } from "../streaming";

const AGGREGATOR_SYSTEM_PROMPT = `You are an aggregator in a Recursive Language Model (RLM) system.
Your task: Synthesize multiple sub-answers into a cohesive final response.

RULES:
1. Combine the sub-answers logically
2. Resolve any contradictions by favoring higher-confidence answers
3. Produce a well-structured markdown response
4. Be concise but complete
5. Do NOT add information not present in the sub-answers`;

interface AggregatorOptions {
  config: RLMConfig;
  originalQuery: string;
  apiKey?: string;
  webSearchEnabled?: boolean;
  thinkingEnabled?: boolean;
}

export async function aggregateResults(
  results: WorkerResult[],
  options: AggregatorOptions
): Promise<RLMOutput> {
  const { config, originalQuery, apiKey, webSearchEnabled, thinkingEnabled } = options;
  if (results.length === 1) return createSimpleOutput(results[0], config);
  const validResults = results.filter((r) => r.confidence > 0.1);
  if (validResults.length === 0) return createErrorOutput(results, config);

  try {
    const subAnswers = [...validResults]
      .sort((a, b) => b.confidence - a.confidence)
      .map(
        (r, i) =>
          `[${i + 1}] Question: ${r.sourceQuery}\nAnswer: ${r.answer}\nConfidence: ${r.confidence}`
      )
      .join("\n\n---\n\n");
    const userPrompt = `ORIGINAL QUERY: ${originalQuery}

SUB-ANSWERS (${validResults.length} total):
${subAnswers}

Synthesize these sub-answers into a cohesive markdown response for the original query.`;

    const provider = normalizeProvider(config.provider);
    const key = getApiKeyForProvider(config.provider, apiKey);
    const resolvedModelId = resolveModelId(config.modelId);
    const optimalConfig = getOptimalConfig(provider, resolvedModelId);
    const maxTokens = config.maxTokens || optimalConfig?.maxTokens || 8000;
    const response = await generateTextWithAISDK(
      provider,
      resolvedModelId,
      key,
      [
        { role: "system", content: AGGREGATOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.5,
        maxTokens,
        webSearch: webSearchEnabled ? { enabled: true, maxUses: 3 } : undefined,
        thinking: thinkingEnabled ? { enabled: true, budgetTokens: 5000 } : undefined,
      }
    );

    const responseTokens =
      typeof response.tokens === "number" ? response.tokens : (response.tokens as { total?: number })?.total ?? 0;
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0) + responseTokens;
    const cacheHits = results.filter((r) => r.fromCache).length;
    const finalTokensObj =
      typeof response.tokens === "object" && response.tokens && "input" in response.tokens
        ? (response.tokens as { input: number; output: number; cached?: number })
        : undefined;
    const tokenUsage = sumTokenUsage(results, finalTokensObj);

    const output: RLMOutput = {
      content: { markdown: response.content },
      metadata: {
        mode: "full",
        depthUsed: 1,
        subCalls: results.length,
        cacheHits,
        tokensUsed: totalTokens,
        ...(tokenUsage && { tokenUsage }),
      },
    };
    if (config.enableReasoning) {
      output.reasoning = { summary: buildReasoningSummary(results), type: "model" };
    }
    return output;
  } catch (error) {
    console.error("[RLM Aggregator] Error:", error);
    return createFallbackOutput(results, config);
  }
}

function createSimpleOutput(result: WorkerResult, config: RLMConfig): RLMOutput {
  const tokenUsage = result.tokenUsage ? sumTokenUsage([result]) : undefined;
  return {
    content: { markdown: result.answer },
    reasoning: config.enableReasoning
      ? { summary: `Direct answer from single sub-query. Confidence: ${result.confidence}`, type: "proxy" }
      : undefined,
    metadata: {
      mode: "full",
      depthUsed: 1,
      subCalls: 1,
      cacheHits: result.fromCache ? 1 : 0,
      tokensUsed: result.tokensUsed,
      ...(tokenUsage && { tokenUsage }),
    },
  };
}

function createErrorOutput(results: WorkerResult[], config: RLMConfig): RLMOutput {
  const tokenUsage = sumTokenUsage(results);
  return {
    content: {
      markdown: `**Unable to generate a complete response.**\n\nThe system attempted ${results.length} sub-queries but could not find sufficient information.`,
    },
    reasoning: config.enableReasoning
      ? { summary: "All sub-queries returned low-confidence or error results.", type: "proxy" }
      : undefined,
    metadata: {
      mode: "full",
      depthUsed: 1,
      subCalls: results.length,
      cacheHits: results.filter((r) => r.fromCache).length,
      tokensUsed: results.reduce((sum, r) => sum + r.tokensUsed, 0),
      ...(tokenUsage && { tokenUsage }),
    },
  };
}

function createFallbackOutput(results: WorkerResult[], config: RLMConfig): RLMOutput {
  const sortedResults = [...results].sort((a, b) => b.confidence - a.confidence);
  const markdown = sortedResults.map((r) => `### ${r.sourceQuery}\n\n${r.answer}`).join("\n\n---\n\n");
  const tokenUsage = sumTokenUsage(results);
  return {
    content: { markdown },
    reasoning: config.enableReasoning
      ? { summary: "Fallback aggregation: answers listed sequentially by confidence.", type: "proxy" }
      : undefined,
    metadata: {
      mode: "full",
      depthUsed: 1,
      subCalls: results.length,
      cacheHits: results.filter((r) => r.fromCache).length,
      tokensUsed: results.reduce((sum, r) => sum + r.tokensUsed, 0),
      ...(tokenUsage && { tokenUsage }),
    },
  };
}

function buildReasoningSummary(results: WorkerResult[]): string {
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const cacheHits = results.filter((r) => r.fromCache).length;
  return `Synthesized ${results.length} sub-queries. Average confidence: ${avgConfidence.toFixed(2)}. Cache hits: ${cacheHits}.`;
}

function sumTokenUsage(results: WorkerResult[], finalResponseTokens?: { input?: number; output?: number; total?: number; cached?: number }): TokenUsageBreakdown | undefined {
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  for (const r of results) {
    if (r.tokenUsage) {
      inputTokens += r.tokenUsage.inputTokens;
      outputTokens += r.tokenUsage.outputTokens;
      cachedTokens += r.tokenUsage.cachedTokens ?? 0;
    }
  }
  if (finalResponseTokens && typeof finalResponseTokens.input === "number" && typeof finalResponseTokens.output === "number") {
    inputTokens += finalResponseTokens.input;
    outputTokens += finalResponseTokens.output;
    cachedTokens += (finalResponseTokens as { cached?: number }).cached ?? 0;
  }
  if (inputTokens === 0 && outputTokens === 0 && cachedTokens === 0) return undefined;
  return { inputTokens, outputTokens, cachedTokens: cachedTokens || undefined };
}

interface StreamingAggregatorOptions extends AggregatorOptions {
  streaming?: StreamingOptions;
}

export async function aggregateResultsStreaming(
  results: WorkerResult[],
  options: StreamingAggregatorOptions
): Promise<RLMOutput> {
  const { config, originalQuery, apiKey, streaming } = options;
  const streamingOpts = { ...DEFAULT_STREAMING_OPTIONS, ...streaming };

  if (results.length === 1) {
    const output = createSimpleOutput(results[0], config);
    if (streamingOpts.onStatus) {
      await streamingOpts.onStatus({
        phase: "streaming",
        currentText: output.content.markdown,
        tokensUsed: output.metadata?.tokensUsed || 0,
        isFinal: false,
      });
    }
    return output;
  }

  const validResults = results.filter((r) => r.confidence > 0.1);
  if (validResults.length === 0) {
    const output = createErrorOutput(results, config);
    if (streamingOpts.onStatus) {
      await streamingOpts.onStatus({
        phase: "streaming",
        currentText: output.content.markdown,
        tokensUsed: output.metadata?.tokensUsed || 0,
        isFinal: false,
      });
    }
    return output;
  }

  try {
    const subAnswers = [...validResults]
      .sort((a, b) => b.confidence - a.confidence)
      .map(
        (r, i) =>
          `[${i + 1}] Question: ${r.sourceQuery}\nAnswer: ${r.answer}\nConfidence: ${r.confidence}`
      )
      .join("\n\n---\n\n");
    const userPrompt = `ORIGINAL QUERY: ${originalQuery}

SUB-ANSWERS (${validResults.length} total):
${subAnswers}

Synthesize these sub-answers into a cohesive markdown response for the original query.`;

    const provider = normalizeProvider(config.provider);
    const key = getApiKeyForProvider(config.provider, apiKey);
    const resolvedModelId = resolveModelId(config.modelId);
    const optimalConfig = getOptimalConfig(provider, resolvedModelId);
    const maxTokens = config.maxTokens || optimalConfig?.maxTokens || 8000;
    const { fullStream } = await streamTextWithAISDK(
      provider,
      resolvedModelId,
      key,
      [
        { role: "system", content: AGGREGATOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.5,
        maxTokens,
        webSearch: options.webSearchEnabled ? { enabled: true, maxUses: 3 } : undefined,
        thinking: options.thinkingEnabled ? { enabled: true, budgetTokens: 5000 } : undefined,
      }
    );

    const processor = new StreamProcessor({
      onChunk: streamingOpts.onChunk,
      onStatus: streamingOpts.onStatus,
      streamingOptions: streamingOpts,
    });
    const streamResult = await processor.processStream(mapAISDKStreamToChunks(fullStream));

    const workerTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    const totalTokens = workerTokens + streamResult.tokensUsed;
    const cacheHits = results.filter((r) => r.fromCache).length;
    const tokenUsage = sumTokenUsage(results);

    const output: RLMOutput = {
      content: { markdown: streamResult.text },
      metadata: {
        mode: "full",
        depthUsed: 1,
        subCalls: results.length,
        cacheHits,
        tokensUsed: totalTokens,
        ...(tokenUsage && { tokenUsage }),
      },
    };
    if (streamResult.citations?.length) {
      output.citations = streamResult.citations.map((c) => ({ url: c.url, title: c.title }));
    }
    if (config.enableReasoning) {
      output.reasoning = {
        summary: streamResult.thinkingText || buildReasoningSummary(results),
        type: streamResult.thinkingText ? "model" : "proxy",
      };
    }
    return output;
  } catch (error) {
    console.error("[RLM Aggregator Streaming] Error:", error);
    if (streamingOpts.onStatus) {
      await streamingOpts.onStatus({
        phase: "error",
        currentText: "",
        tokensUsed: results.reduce((sum, r) => sum + r.tokensUsed, 0),
        isFinal: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return createFallbackOutput(results, config);
  }
}

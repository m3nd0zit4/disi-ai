/**
 * RLM Worker - Focused answering on partial context at depth >= 1.
 */

import { ReasoningContext } from "@/lib/reasoning/types";
import { distillContext } from "@/lib/reasoning/distillation";
import { generateTextWithAISDK } from "@/lib/ai-sdk-adapter";
import { WorkerResult, RLMConfig, SubQueryProposal } from "../types";
import { RLMCache, resolveModelId, getApiKeyForProvider, normalizeProvider } from "../internal";

const WORKER_SYSTEM_PROMPT = `You are a focused worker in a Recursive Language Model (RLM) system.
Your task: Answer the specific question using ONLY the provided context.

RULES:
1. Be concise and direct
2. Only use information from the provided context
3. If the context doesn't contain the answer, say so clearly
4. End your response with a confidence score from 0 to 1

Format your response as:
ANSWER: [your answer]
CONFIDENCE: [0.0 to 1.0]`;

interface WorkerOptions {
  config: RLMConfig;
  cache?: RLMCache;
  apiKey?: string;
  depth: number;
}

export async function executeWorker(
  subQuery: SubQueryProposal,
  context: ReasoningContext,
  options: WorkerOptions
): Promise<WorkerResult> {
  const { config, cache, apiKey, depth } = options;
  const contextHash = context.items.map((i) => `${i.content.substring(0, 100)}|${i.content.length}`).join("|");
  const queryHash = cache?.generateHash(subQuery.query, contextHash) || "";

  if (cache && queryHash) {
    const cached = cache.get(queryHash);
    if (cached) return cached;
  }

  try {
    const workerBudget = Math.floor(config.tokenBudget / (config.maxChildCalls + 1));
    const distilledContext = distillContext(context, { maxTokens: workerBudget });
    const contextStr = distilledContext.items
      .map((item, i) => `[${i + 1}] ${item.role.toUpperCase()}:\n${item.content}`)
      .join("\n\n---\n\n");
    const userPrompt = `QUESTION: ${subQuery.query}

RATIONALE: ${subQuery.rationale}

CONTEXT:
${contextStr}

Answer the question based on the context above.`;

    const provider = normalizeProvider(config.provider);
    const key = getApiKeyForProvider(config.provider, apiKey);
    const modelId = resolveModelId(config.modelId);
    const response = await generateTextWithAISDK(
      provider,
      modelId,
      key,
      [
        { role: "system", content: WORKER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.5 }
    );

    const { answer, confidence } = parseWorkerResponse(response.content);
    const tokensUsed = typeof response.tokens === "number" ? response.tokens : response.tokens.total;
    const tokenUsage =
      typeof response.tokens === "object" && response.tokens && "input" in response.tokens && "output" in response.tokens
        ? {
            inputTokens: response.tokens.input,
            outputTokens: response.tokens.output,
            cachedTokens: "cached" in response.tokens ? (response.tokens as { cached?: number }).cached : undefined,
          }
        : undefined;
    const result: WorkerResult = {
      answer,
      confidence,
      sourceQuery: subQuery.query,
      tokensUsed,
      ...(tokenUsage && { tokenUsage }),
      fromCache: false,
    };
    if (cache && queryHash) cache.set(queryHash, result);
    return result;
  } catch (error) {
    console.error(`[RLM Worker] Error at depth ${depth}:`, error);
    return {
      answer: `Unable to answer: ${error instanceof Error ? error.message : String(error)}`,
      confidence: 0,
      sourceQuery: subQuery.query,
      tokensUsed: 0,
      fromCache: false,
    };
  }
}

function parseWorkerResponse(content: string): { answer: string; confidence: number } {
  const lines = content.split("\n");
  let answer = content;
  let confidence = 0.5;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase().startsWith("ANSWER:")) answer = trimmed.substring(7).trim();
    else if (trimmed.toUpperCase().startsWith("CONFIDENCE:")) {
      const parsed = parseFloat(trimmed.substring(11).trim());
      confidence = !isNaN(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.5;
    }
  }
  if (answer === content && !content.includes("ANSWER:")) {
    const confMatch = content.match(/confidence[:\s]+([0-9.]+)/i);
    if (confMatch) {
      const parsed = parseFloat(confMatch[1]);
      confidence = !isNaN(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.5;
      answer = content.replace(/confidence[:\s]+[0-9.]+/i, "").trim();
    }
  }
  return { answer, confidence };
}

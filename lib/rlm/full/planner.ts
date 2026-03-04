/**
 * RLM Planner - Depth 0 model that proposes sub-queries.
 * Does NOT execute recursion; orchestrator decides whether to run them.
 */

import { ReasoningContext } from "@/lib/reasoning/types";
import { generateTextWithAISDK } from "@/lib/ai-sdk-adapter";
import { PlannerResult, SubQueryProposal, RLMConfig } from "../types";
import { resolveModelId, getApiKeyForProvider, normalizeProvider } from "../internal";

const PLANNER_SYSTEM_PROMPT = `You are a planner in a Recursive Language Model (RLM) system.
Your task: Analyze the query and context, determine if sub-queries are needed.

RULES:
1. If you can answer confidently with the given context, set canAnswerDirectly = true
2. If information is missing or ambiguous, propose focused sub-queries
3. Propose at most 5 sub-queries
4. Each sub-query should target SPECIFIC missing information
5. Do NOT answer the main question - only identify what's needed

You MUST respond with valid JSON in this exact format:
{
  "needsSubQueries": boolean,
  "subQueries": [
    { "query": "specific focused question", "rationale": "why this is needed", "priority": 1 }
  ],
  "canAnswerDirectly": boolean,
  "directAnswer": "only if canAnswerDirectly is true"
}

Priority scale: 1 = highest priority, 5 = lowest priority`;

interface PlannerOptions {
  config: RLMConfig;
  apiKey?: string;
}

export async function runPlanner(
  query: string,
  context: ReasoningContext,
  options: PlannerOptions
): Promise<PlannerResult> {
  const { config, apiKey } = options;
  const contextSummary = context.items
    .map(
      (item, i) =>
        `[${i + 1}] ${item.role.toUpperCase()}: ${item.content.substring(0, 500)}${item.content.length > 500 ? "..." : ""}`
    )
    .join("\n\n");
  const userPrompt = `QUERY: ${query}

AVAILABLE CONTEXT (${context.items.length} items, ${context.totalTokens || "unknown"} tokens):
${contextSummary}

Analyze this query and context. Respond with JSON only.`;

  try {
    const provider = normalizeProvider(config.provider);
    const key = getApiKeyForProvider(config.provider, apiKey);
    const modelId = resolveModelId(config.modelId);
    const response = await generateTextWithAISDK(
      provider,
      modelId,
      key,
      [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3 }
    );
    const tokensUsed = typeof response.tokens === "number" ? response.tokens : response.tokens.total;
    const parsed = parseJsonResponse(response.content);
    return normalizePlannerResult(parsed, tokensUsed);
  } catch (error) {
    console.error("[RLM Planner] Error:", error);
    return {
      needsSubQueries: false,
      subQueries: [],
      canAnswerDirectly: false,
      directAnswer: undefined,
      tokensUsed: 0,
    };
  }
}

function parseJsonResponse(content: string): unknown {
  let cleaned = content.trim();
  if (cleaned.toLowerCase().startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim());
}

function normalizePlannerResult(parsed: unknown, tokensUsed: number): PlannerResult {
  const obj = parsed as Record<string, unknown>;
  const subQueries: SubQueryProposal[] = [];
  if (Array.isArray(obj.subQueries)) {
    for (const sq of obj.subQueries.slice(0, 5)) {
      if (typeof sq === "object" && sq !== null) {
        const sqObj = sq as Record<string, unknown>;
        subQueries.push({
          query: String(sqObj.query || ""),
          rationale: String(sqObj.rationale || ""),
          priority: Number(sqObj.priority) || 3,
        });
      }
    }
  }
  subQueries.sort((a, b) => a.priority - b.priority);
  return {
    needsSubQueries: Boolean(obj.needsSubQueries) && subQueries.length > 0,
    subQueries,
    canAnswerDirectly: Boolean(obj.canAnswerDirectly),
    directAnswer: typeof obj.directAnswer === "string" ? obj.directAnswer : undefined,
    tokensUsed,
  };
}

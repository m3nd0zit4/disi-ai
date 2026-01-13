/**
 * RLM Planner - Depth 0 model that proposes sub-queries
 * 
 * The planner does NOT execute recursion.
 * It analyzes the query + context and proposes focused sub-queries.
 * The orchestrator decides whether to execute them.
 */

import { ReasoningContext } from "@/lib/reasoning/types";
import { getAIService } from "@/lib/aiServices";
import { PlannerResult, SubQueryProposal, RLMConfig } from "./types";

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

/**
 * Run the planner to analyze query and propose sub-queries
 */
export async function runPlanner(
  query: string,
  context: ReasoningContext,
  options: PlannerOptions
): Promise<PlannerResult> {
  const { config, apiKey } = options;

  // Build context summary for planner
  const contextSummary = context.items.map((item, i) => 
    `[${i + 1}] ${item.role.toUpperCase()}: ${item.content.substring(0, 500)}${item.content.length > 500 ? '...' : ''}`
  ).join('\n\n');

  const userPrompt = `QUERY: ${query}

AVAILABLE CONTEXT (${context.items.length} items, ${context.totalTokens || 'unknown'} tokens):
${contextSummary}

Analyze this query and context. Respond with JSON only.`;

  try {
    const provider = config.provider || "openai";
    const key = apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || "";
    const service = getAIService(provider, key);

    const response = await service.generateResponse({
      model: config.modelId || "gpt-4o",
      messages: [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3, // Low temperature for structured output
    });

    // Parse JSON response
    const parsed = parseJsonResponse(response.content);
    
    // Validate and normalize
    return normalizePlannerResult(parsed, response.tokens || 0);

  } catch (error) {
    console.error("[RLM Planner] Error:", error);
    
    // Fallback: answer directly if planner fails
    return {
      needsSubQueries: false,
      subQueries: [],
      canAnswerDirectly: false,
      directAnswer: undefined, // Will trigger simple fallback
      tokensUsed: 0,
    };

  }
}

/**
 * Parse JSON from LLM response (handles markdown code blocks)
 */
function parseJsonResponse(content: string): unknown {
  // Remove markdown code blocks if present
  let cleaned = content.trim();
  
  // Case-insensitive check for ```json
  if (cleaned.toLowerCase().startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  
  return JSON.parse(cleaned.trim());
}

/**
 * Normalize and validate planner output
 */
function normalizePlannerResult(parsed: unknown, tokensUsed: number): PlannerResult {
  const obj = parsed as Record<string, unknown>;
  
  const subQueries: SubQueryProposal[] = [];
  
  if (Array.isArray(obj.subQueries)) {
    for (const sq of obj.subQueries.slice(0, 5)) { // Max 5
      if (typeof sq === 'object' && sq !== null) {
        const sqObj = sq as Record<string, unknown>;
        subQueries.push({
          query: String(sqObj.query || ''),
          rationale: String(sqObj.rationale || ''),
          priority: Number(sqObj.priority) || 3,
        });
      }
    }
  }

  // Sort by priority
  subQueries.sort((a, b) => a.priority - b.priority);

  return {
    needsSubQueries: Boolean(obj.needsSubQueries) && subQueries.length > 0,
    subQueries,
    canAnswerDirectly: Boolean(obj.canAnswerDirectly),
    directAnswer: typeof obj.directAnswer === 'string' ? obj.directAnswer : undefined,
    tokensUsed,
  };
}

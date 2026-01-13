/**
 * RLM Worker - Focused answering on partial context
 * 
 * Workers operate at depth >= 1 and answer specific focused questions.
 * They receive sliced context relevant to their sub-query.
 */

import { ReasoningContext } from "@/lib/reasoning/types";
import { distillContext } from "@/lib/reasoning/distillation";
import { getAIService } from "@/lib/aiServices";
import { WorkerResult, RLMConfig, SubQueryProposal } from "./types";
import { RLMCache } from "./cache";

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

/**
 * Execute a worker to answer a focused sub-query
 */
export async function executeWorker(
  subQuery: SubQueryProposal,
  context: ReasoningContext,
  options: WorkerOptions
): Promise<WorkerResult> {
  const { config, cache, apiKey, depth } = options;

  // Generate cache hash
  const contextHash = context.items.map(i => `${i.content.substring(0, 100)}|${i.content.length}`).join('|');

  const queryHash = cache?.generateHash(subQuery.query, contextHash) || '';

  // Check cache
  if (cache && queryHash) {
    const cached = cache.get(queryHash);
    if (cached) {
      return cached;
    }
  }

  try {
    // Distill context for this specific query
    const workerBudget = Math.floor(config.tokenBudget / (config.maxChildCalls + 1));
    const distilledContext = distillContext(context, { maxTokens: workerBudget });

    // Build context for worker
    const contextStr = distilledContext.items.map((item, i) => 
      `[${i + 1}] ${item.role.toUpperCase()}:\n${item.content}`
    ).join('\n\n---\n\n');

    const userPrompt = `QUESTION: ${subQuery.query}

RATIONALE: ${subQuery.rationale}

CONTEXT:
${contextStr}

Answer the question based on the context above.`;

    // Call LLM
    const provider = config.provider || "openai";
    const key = apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || "";
    const service = getAIService(provider, key);

    const response = await service.generateResponse({
      model: config.modelId || "gpt-4o",
      messages: [
        { role: "system", content: WORKER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
    });

    // Parse response
    const { answer, confidence } = parseWorkerResponse(response.content);

    const result: WorkerResult = {
      answer,
      confidence,
      sourceQuery: subQuery.query,
      tokensUsed: response.tokens,
      fromCache: false,
    };

    // Cache result
    if (cache && queryHash) {
      cache.set(queryHash, result);
    }

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

/**
 * Parse worker response to extract answer and confidence
 */
function parseWorkerResponse(content: string): { answer: string; confidence: number } {
  const lines = content.split('\n');
  let answer = content;
  let confidence = 0.5;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.toUpperCase().startsWith('ANSWER:')) {
      answer = trimmed.substring(7).trim();
    } else if (trimmed.toUpperCase().startsWith('CONFIDENCE:')) {
      const confStr = trimmed.substring(11).trim();
      const parsed = parseFloat(confStr);
      if (!isNaN(parsed)) {
        confidence = Math.max(0, Math.min(1, parsed));
      } else {
        confidence = 0.5;
      }

    }
  }

  // If no structured format, use whole content as answer
  if (answer === content && !content.includes('ANSWER:')) {
    // Extract confidence if present at end
    const confMatch = content.match(/confidence[:\s]+([0-9.]+)/i);
    if (confMatch) {
      const parsed = parseFloat(confMatch[1]);
      confidence = !isNaN(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.5;
      answer = content.replace(/confidence[:\s]+[0-9.]+/i, '').trim();
    }

  }

  return { answer, confidence };
}

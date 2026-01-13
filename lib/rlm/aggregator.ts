/**
 * RLM Aggregator - Combines worker results into final output
 * 
 * Takes multiple worker results and synthesizes them into a cohesive
 * markdown response with optional reasoning summary.
 */

import { getAIService } from "@/lib/aiServices";
import { WorkerResult, RLMConfig, RLMOutput } from "./types";

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
}

/**
 * Aggregate worker results into final output
 */
export async function aggregateResults(
  results: WorkerResult[],
  options: AggregatorOptions
): Promise<RLMOutput> {
  const { config, originalQuery, apiKey } = options;

  // If only one result or low complexity, skip LLM aggregation
  if (results.length === 1) {
    return createSimpleOutput(results[0], config);
  }

  // If all results are low confidence or errors, return best effort
  const validResults = results.filter(r => r.confidence > 0.1);
  if (validResults.length === 0) {
    return createErrorOutput(results, config);
  }

  try {
    // Build sub-answers summary
    const subAnswers = [...validResults]
      .sort((a, b) => b.confidence - a.confidence)
      .map((r, i) => `[${i + 1}] Question: ${r.sourceQuery}
Answer: ${r.answer}
Confidence: ${r.confidence}`)
      .join('\n\n---\n\n');

    const userPrompt = `ORIGINAL QUERY: ${originalQuery}

SUB-ANSWERS (${validResults.length} total):
${subAnswers}

Synthesize these sub-answers into a cohesive markdown response for the original query.`;


    // Call LLM
    const provider = config.provider || "openai";
    const key = apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || "";
    const service = getAIService(provider, key);

    const response = await service.generateResponse({
      model: config.modelId || "gpt-4o",
      messages: [
        { role: "system", content: AGGREGATOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
    });

    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0) + response.tokens;
    const cacheHits = results.filter(r => r.fromCache).length;

    const output: RLMOutput = {
      content: {
        markdown: response.content,
      },
      metadata: {
        mode: "full",
        depthUsed: 1, // Will be overridden by orchestrator
        subCalls: results.length,
        cacheHits,
        tokensUsed: totalTokens,
      },
    };

    if (config.enableReasoning) {
      output.reasoning = {
        summary: buildReasoningSummary(results),
        type: "model",
      };
    }

    return output;

  } catch (error) {
    console.error("[RLM Aggregator] Error:", error);
    
    // Fallback: concatenate answers
    return createFallbackOutput(results, config);
  }
}

/**
 * Create output from single result
 */
function createSimpleOutput(result: WorkerResult, config: RLMConfig): RLMOutput {
  return {
    content: {
      markdown: result.answer,
    },
    reasoning: config.enableReasoning ? {
      summary: `Direct answer from single sub-query. Confidence: ${result.confidence}`,
      type: "proxy",
    } : undefined,
    metadata: {
      mode: "full",
      depthUsed: 1,
      subCalls: 1,
      cacheHits: result.fromCache ? 1 : 0,
      tokensUsed: result.tokensUsed,
    },
  };
}

/**
 * Create output when all results are errors
 */
function createErrorOutput(results: WorkerResult[], config: RLMConfig): RLMOutput {
  return {
    content: {
      markdown: `**Unable to generate a complete response.**\n\nThe system attempted ${results.length} sub-queries but could not find sufficient information.`,
    },
    reasoning: config.enableReasoning ? {
      summary: "All sub-queries returned low-confidence or error results.",
      type: "proxy",
    } : undefined,
    metadata: {
      mode: "full",
      depthUsed: 1,
      subCalls: results.length,
      cacheHits: results.filter(r => r.fromCache).length,
      tokensUsed: results.reduce((sum, r) => sum + r.tokensUsed, 0),
    },
  };
}

/**
 * Fallback output by concatenating answers
 */
function createFallbackOutput(results: WorkerResult[], config: RLMConfig): RLMOutput {
  const sortedResults = [...results].sort((a, b) => b.confidence - a.confidence);
  const markdown = sortedResults
    .map(r => `### ${r.sourceQuery}\n\n${r.answer}`)
    .join('\n\n---\n\n');

  return {
    content: { markdown },
    reasoning: config.enableReasoning ? {
      summary: "Fallback aggregation: answers listed sequentially by confidence.",
      type: "proxy",
    } : undefined,
    metadata: {
      mode: "full",
      depthUsed: 1,
      subCalls: results.length,
      cacheHits: results.filter(r => r.fromCache).length,
      tokensUsed: results.reduce((sum, r) => sum + r.tokensUsed, 0),
    },
  };
}

/**
 * Build reasoning summary from results
 */
function buildReasoningSummary(results: WorkerResult[]): string {
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const cacheHits = results.filter(r => r.fromCache).length;
  
  return `Synthesized ${results.length} sub-queries. Average confidence: ${avgConfidence.toFixed(2)}. Cache hits: ${cacheHits}.`;
}

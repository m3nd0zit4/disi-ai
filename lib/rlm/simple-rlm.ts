/**
 * Simple RLM - Single-depth execution without sub-calls
 * 
 * For easy/straightforward queries that don't require recursive decomposition.
 * - Distills context
 * - Makes single LLM call
 * - Returns structured output
 */

import { ReasoningContext } from "@/lib/reasoning/types";
import { distillContext } from "@/lib/reasoning/distillation";
import { buildReasoningPrompt } from "@/lib/reasoning/prompt";
import { getAIService } from "@/lib/aiServices";
import { RLMConfig, RLMOutput, RLMExecutionState, DEFAULT_RLM_CONFIG } from "./types";
import { BudgetManager } from "./budget";

export interface SimpleRLMOptions {
  config?: Partial<RLMConfig>;
  systemPrompt?: string;
  apiKey?: string;
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

  try {
    // 1. Distill context to fit budget
    const contextBudget = Math.floor(config.tokenBudget * 0.7); // Reserve 30% for response
    const distilledContext = distillContext(context, { maxTokens: contextBudget });
    
    // 2. Build prompt
    const messages = buildReasoningPrompt(
      options.systemPrompt,
      distilledContext,
      query
    );

    // 3. Call LLM
    const provider = config.provider || "openai";
    const apiKey = options.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || "";
    const service = getAIService(provider, apiKey);

    const response = await service.generateResponse({
      model: config.modelId || "gpt-4o",
      messages: messages as Array<{ role: string; content: string }>,
      temperature: 0.7,
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

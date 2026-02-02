/**
 * RLM Orchestrator - The authoritative controller
 * 
 * Controls ALL recursion, caching, and budget management.
 * The LLM never executes recursion directly - it only proposes.
 * 
 * Flow:
 * 1. Receive query + context
 * 2. Determine mode (simple vs full)
 * 3. If simple: single LLM call
 * 4. If full: planner → workers → aggregator
 */

import { ReasoningContext } from "@/lib/reasoning/types";
import {
  RLMConfig,
  RLMOutput,
  RLMExecutionState,
  DEFAULT_RLM_CONFIG,
  WorkerResult,
  StreamingOptions,
  StreamStatus,
  DEFAULT_STREAMING_OPTIONS,
} from "./types";
import { RLMCache, getGlobalCache } from "./cache";
import { BudgetManager } from "./budget";
import { executeSimpleRLM, executeSimpleRLMStreaming } from "./simple-rlm";
import { runPlanner } from "./planner";
import { executeWorker } from "./worker";
import { aggregateResults, aggregateResultsStreaming } from "./aggregator";
import { PromptEnvironment, createEnvironmentFromContext } from "./environment";

// Non-negotiable limits
const MAX_DEPTH = 3;
const MAX_CHILD_CALLS = 5;

export interface OrchestratorOptions {
  config?: Partial<RLMConfig>;
  apiKey?: string;
  systemPrompt?: string;
}

/**
 * Main RLM Orchestrator class
 */
export class RLMOrchestrator {
  private config: RLMConfig;
  private cache: RLMCache;
  private budget: BudgetManager;
  private state: RLMExecutionState;
  private apiKey?: string;
  private systemPrompt?: string;
  private environment?: PromptEnvironment;

  constructor(options: OrchestratorOptions = {}) {
    this.config = {
      ...DEFAULT_RLM_CONFIG,
      ...options.config,
      maxDepth: Math.min(options.config?.maxDepth ?? MAX_DEPTH, MAX_DEPTH),
      maxChildCalls: Math.min(options.config?.maxChildCalls ?? MAX_CHILD_CALLS, MAX_CHILD_CALLS),
    };
    this.cache = getGlobalCache();
    this.budget = new BudgetManager(this.config.tokenBudget, MAX_CHILD_CALLS * MAX_DEPTH);
    this.apiKey = options.apiKey;
    this.systemPrompt = options.systemPrompt;
    
    this.state = {
      depth: 0,
      childCallCount: 0,
      tokensUsed: 0,
      cacheHits: 0,
      stoppedEarly: false,
    };
  }

  /**
   * Execute RLM on query + context
   */
  async execute(query: string, context: ReasoningContext): Promise<RLMOutput> {
    this.resetState();
    const mode = this.determineMode(query, context);
    console.log(`[RLM Orchestrator] Mode: ${mode}, Context items: ${context.items.length}`);

    if (mode === "simple") {
      return this.executeSimple(query, context);
    } else {
      return this.executeFull(query, context, 0);
    }
  }

  /**
   * Execute with Environment ε (prompt-as-variable)
   */
  async executeWithEnvironment(query: string, context: ReasoningContext): Promise<RLMOutput> {
    this.resetState();

    this.environment = createEnvironmentFromContext(context.items, {
      modelId: this.config.modelId || "gpt-4o",
      provider: this.config.provider || "openai",
      apiKey: this.apiKey,
      enableCache: this.config.enableCache,
    });

    const envSummary = this.environment.getSummary();
    console.log(`[RLM Orchestrator] Environment: ${envSummary.estimatedTokens} tokens`);

    if (envSummary.estimatedTokens < 2000) {
      return this.executeSimple(query, context);
    }

    try {
      const chunks = this.environment.chunks(4000);
      console.log(`[RLM Orchestrator] Map-reduce over ${chunks.length} chunks`);

      const results = await this.environment.mapReduce(
        query,
        `Based on the partial answers, provide a final answer to: "${query}"`,
        chunks
      );

      this.state.tokensUsed = results.results.reduce((sum, r) => sum + r.tokens, 0);
      this.state.childCallCount = results.results.length;
      this.state.cacheHits = results.results.filter(r => r.fromCache).length;

      return {
        content: { markdown: results.aggregated },
        reasoning: this.config.enableReasoning ? {
          summary: `Map-reduce over ${chunks.length} chunks.`,
          type: "model",
        } : undefined,
        metadata: {
          mode: "full",
          depthUsed: 1,
          subCalls: this.state.childCallCount,
          cacheHits: this.state.cacheHits,
          tokensUsed: this.state.tokensUsed,
        },
      };
    } catch (error) {
      console.error("[RLM Orchestrator] Environment execution failed:", error);
      this.resetState();
      return this.execute(query, context);
    }
  }

  private determineMode(query: string, context: ReasoningContext): "simple" | "full" {
    if (this.config.mode === "simple" || this.config.mode === "full") {
      return this.config.mode;
    }
    const contextTokens = context.totalTokens || this.estimateTokens(context);
    if (contextTokens < 2000 && query.length < 200) return "simple";
    if (context.items.length <= 2) return "simple";
    return "full";
  }

  private async executeSimple(query: string, context: ReasoningContext): Promise<RLMOutput> {
    const result = await executeSimpleRLM(query, context, {
      config: this.config,
      systemPrompt: this.systemPrompt,
      apiKey: this.apiKey,
    });
    this.state.tokensUsed = result.metadata?.tokensUsed || 0;
    return result;
  }

  private async executeFull(query: string, context: ReasoningContext, depth: number): Promise<RLMOutput> {
    if (depth >= this.config.maxDepth) {
      this.state.stoppedEarly = true;
      this.state.stopReason = "max_depth";
      return this.executeSimple(query, context);
    }

    if (!this.budget.canMakeCall()) {
      this.state.stoppedEarly = true;
      this.state.stopReason = "budget";
      return this.executeSimple(query, context);
    }

    const plannerResult = await runPlanner(query, context, { config: this.config, apiKey: this.apiKey });
    this.budget.consume(plannerResult.tokensUsed);
    this.state.tokensUsed += plannerResult.tokensUsed;

    if (plannerResult.canAnswerDirectly && plannerResult.directAnswer) {
      return {
        content: { markdown: plannerResult.directAnswer },
        metadata: { 
          mode: "full", 
          depthUsed: depth, 
          subCalls: 0, 
          cacheHits: 0, 
          tokensUsed: this.state.tokensUsed 
        },
      };
    }

    if (!plannerResult.needsSubQueries || plannerResult.subQueries.length === 0) {
      return this.executeSimple(query, context);
    }

    const subQueries = plannerResult.subQueries.slice(0, this.config.maxChildCalls);
    const workerResults: WorkerResult[] = [];

    for (const subQuery of subQueries) {
      if (!this.budget.canMakeCall()) {
        this.state.stoppedEarly = true;
        break;
      }

      const cacheHash = this.cache.generateHash(subQuery.query, JSON.stringify(context.items.map(i => i.content.substring(0, 100))));
      const cached = this.cache.get(cacheHash);
      
      if (cached) {
        this.state.cacheHits++;
        workerResults.push(cached);
        continue;
      }

      const result = await executeWorker(subQuery, context, {
        config: this.config,
        cache: this.cache,
        apiKey: this.apiKey,
        depth: depth + 1,
      });

      this.budget.consume(result.tokensUsed);
      this.state.tokensUsed += result.tokensUsed;
      this.state.childCallCount++;
      if (result.fromCache) this.state.cacheHits++;
      workerResults.push(result);

      if (result.confidence >= 0.95) {
        this.state.stoppedEarly = true;
        this.state.stopReason = "high_confidence";
        break;
      }
    }

    const output = await aggregateResults(workerResults, {
      config: this.config,
      originalQuery: query,
      apiKey: this.apiKey,
    });

    if (output.metadata) {
      output.metadata.depthUsed = depth + 1;
      output.metadata.cacheHits = this.state.cacheHits;
      output.metadata.tokensUsed = this.state.tokensUsed;
    }

    return output;
  }

  private estimateTokens(context: ReasoningContext): number {
    return Math.ceil(context.items.reduce((sum, item) => sum + item.content.length, 0) / 4);
  }

  private resetState(): void {
    this.state = { depth: 0, childCallCount: 0, tokensUsed: 0, cacheHits: 0, stoppedEarly: false };
    this.budget.reset();
  }

  getState(): RLMExecutionState {
    return { ...this.state };
  }

  getEnvironment(): PromptEnvironment | undefined {
    return this.environment;
  }
}

/**
 * Convenience function for one-off RLM execution
 */
export async function executeRLM(
  query: string,
  context: ReasoningContext,
  options: OrchestratorOptions & { useEnvironment?: boolean } = {}
): Promise<RLMOutput> {
  const orchestrator = new RLMOrchestrator(options);
  if (options.useEnvironment) {
    return orchestrator.executeWithEnvironment(query, context);
  }
  return orchestrator.execute(query, context);
}

/**
 * Streaming RLM execution options
 */
export interface StreamingOrchestratorOptions extends OrchestratorOptions {
  streaming?: StreamingOptions;
}

/**
 * Execute RLM with streaming support for both simple and full modes
 *
 * Flow for full mode:
 * 1. Phase: "planning" - Planner analyzes query
 * 2. Phase: "researching" - Workers answer sub-queries (with progress)
 * 3. Phase: "synthesizing" - Aggregator starts combining
 * 4. Phase: "streaming" - Final response streams progressively
 * 5. Phase: "complete" - Execution finished
 */
export async function executeRLMStreaming(
  query: string,
  context: ReasoningContext,
  options: StreamingOrchestratorOptions = {}
): Promise<RLMOutput> {
  const config: RLMConfig = {
    ...DEFAULT_RLM_CONFIG,
    ...options.config,
    maxDepth: Math.min(options.config?.maxDepth ?? MAX_DEPTH, MAX_DEPTH),
    maxChildCalls: Math.min(options.config?.maxChildCalls ?? MAX_CHILD_CALLS, MAX_CHILD_CALLS),
  };

  const streamingOpts = { ...DEFAULT_STREAMING_OPTIONS, ...options.streaming };
  const cache = getGlobalCache();
  const budget = new BudgetManager(config.tokenBudget, MAX_CHILD_CALLS * MAX_DEPTH);

  const state: RLMExecutionState = {
    depth: 0,
    childCallCount: 0,
    tokensUsed: 0,
    cacheHits: 0,
    stoppedEarly: false,
  };

  // Helper to emit status updates
  const emitStatus = async (status: Partial<StreamStatus>) => {
    if (streamingOpts.onStatus) {
      await streamingOpts.onStatus({
        phase: "thinking",
        currentText: "",
        tokensUsed: state.tokensUsed,
        isFinal: false,
        ...status,
      } as StreamStatus);
    }
  };

  // Determine mode
  const determineMode = (): "simple" | "full" => {
    if (config.mode === "simple" || config.mode === "full") return config.mode;
    const contextTokens = context.totalTokens || Math.ceil(context.items.reduce((sum, item) => sum + item.content.length, 0) / 4);
    if (contextTokens < 2000 && query.length < 200) return "simple";
    if (context.items.length <= 2) return "simple";
    return "full";
  };

  const mode = determineMode();
  console.log(`[RLM Orchestrator Streaming] Mode: ${mode}, Context items: ${context.items.length}`);

  // ===== SIMPLE MODE: Use streaming simple RLM =====
  if (mode === "simple") {
    return executeSimpleRLMStreaming(query, context, {
      config,
      systemPrompt: options.systemPrompt,
      apiKey: options.apiKey,
      streaming: streamingOpts,
    });
  }

  // ===== FULL MODE: Planner → Workers → Aggregator with progress =====
  try {
    // Phase 1: Planning
    await emitStatus({
      phase: "planning",
      progress: {
        currentStep: 1,
        totalSteps: 3,
        stepDescription: "Analyzing query and planning approach...",
      },
    });

    const plannerResult = await runPlanner(query, context, { config, apiKey: options.apiKey });
    budget.consume(plannerResult.tokensUsed);
    state.tokensUsed += plannerResult.tokensUsed;

    // If planner can answer directly, stream that
    if (plannerResult.canAnswerDirectly && plannerResult.directAnswer) {
      await emitStatus({
        phase: "streaming",
        currentText: plannerResult.directAnswer,
      });
      await emitStatus({
        phase: "complete",
        currentText: plannerResult.directAnswer,
        tokensUsed: state.tokensUsed,
        isFinal: true,
      });

      return {
        content: { markdown: plannerResult.directAnswer },
        metadata: {
          mode: "full",
          depthUsed: 0,
          subCalls: 0,
          cacheHits: 0,
          tokensUsed: state.tokensUsed,
        },
      };
    }

    // If no sub-queries needed, fall back to simple streaming
    if (!plannerResult.needsSubQueries || plannerResult.subQueries.length === 0) {
      return executeSimpleRLMStreaming(query, context, {
        config,
        systemPrompt: options.systemPrompt,
        apiKey: options.apiKey,
        streaming: streamingOpts,
      });
    }

    // Phase 2: Research - Execute workers with progress
    const subQueries = plannerResult.subQueries.slice(0, config.maxChildCalls);
    const workerResults: WorkerResult[] = [];

    await emitStatus({
      phase: "researching",
      progress: {
        currentStep: 2,
        totalSteps: 3,
        stepDescription: `Processing ${subQueries.length} sub-queries...`,
        subQueries: subQueries.map(sq => sq.query),
        currentWorker: 0,
        totalWorkers: subQueries.length,
      },
    });

    for (let i = 0; i < subQueries.length; i++) {
      const subQuery = subQueries[i];

      if (!budget.canMakeCall()) {
        state.stoppedEarly = true;
        break;
      }

      // Update progress for each worker
      await emitStatus({
        phase: "researching",
        progress: {
          currentStep: 2,
          totalSteps: 3,
          stepDescription: `Researching: "${subQuery.query.substring(0, 50)}..."`,
          subQueries: subQueries.map(sq => sq.query),
          currentWorker: i + 1,
          totalWorkers: subQueries.length,
        },
      });

      // Check cache
      const cacheHash = cache.generateHash(
        subQuery.query,
        JSON.stringify(context.items.map(item => item.content.substring(0, 100)))
      );
      const cached = cache.get(cacheHash);

      if (cached) {
        state.cacheHits++;
        workerResults.push(cached);
        continue;
      }

      // Execute worker
      const result = await executeWorker(subQuery, context, {
        config,
        cache,
        apiKey: options.apiKey,
        depth: 1,
      });

      budget.consume(result.tokensUsed);
      state.tokensUsed += result.tokensUsed;
      state.childCallCount++;
      if (result.fromCache) state.cacheHits++;
      workerResults.push(result);

      // Early stop on high confidence
      if (result.confidence >= 0.95) {
        state.stoppedEarly = true;
        state.stopReason = "high_confidence";
        break;
      }
    }

    // Phase 3: Synthesizing - Aggregate with streaming
    await emitStatus({
      phase: "synthesizing",
      progress: {
        currentStep: 3,
        totalSteps: 3,
        stepDescription: "Synthesizing final response...",
      },
    });

    // Use streaming aggregator
    const output = await aggregateResultsStreaming(workerResults, {
      config,
      originalQuery: query,
      apiKey: options.apiKey,
      streaming: streamingOpts,
    });

    // Final status update
    await emitStatus({
      phase: "complete",
      currentText: output.content.markdown,
      tokensUsed: state.tokensUsed + (output.metadata?.tokensUsed || 0),
      isFinal: true,
    });

    // Update metadata
    if (output.metadata) {
      output.metadata.depthUsed = 1;
      output.metadata.cacheHits = state.cacheHits;
      output.metadata.tokensUsed = state.tokensUsed + output.metadata.tokensUsed;
    }

    return output;

  } catch (error) {
    console.error("[RLM Orchestrator Streaming] Error:", error);

    await emitStatus({
      phase: "error",
      currentText: "",
      tokensUsed: state.tokensUsed,
      isFinal: true,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      content: {
        markdown: `**Error during RLM execution:**\n\n${error instanceof Error ? error.message : String(error)}`,
      },
      metadata: {
        mode: "full",
        depthUsed: 0,
        subCalls: state.childCallCount,
        cacheHits: state.cacheHits,
        tokensUsed: state.tokensUsed,
      },
    };
  }
}

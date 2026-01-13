/**
 * RLM Module Index - Public exports
 */

// Types
export type {
  RLMMode,
  RLMConfig,
  RLMOutput,
  RLMExecutionState,
  SubQueryProposal,
  PlannerResult,
  WorkerResult,
  ContextSliceSpec,
  CachedResult,
} from "./types";

export { DEFAULT_RLM_CONFIG } from "./types";

// Core components
export { RLMOrchestrator, executeRLM } from "./orchestrator";
export { executeSimpleRLM } from "./simple-rlm";

// Environment (Prompt-as-Variable)
export { 
  PromptEnvironment, 
  createEnvironment, 
  createEnvironmentFromContext,
  type PromptSlice,
  type QueryResult,
  type EnvironmentConfig,
} from "./environment";

// Internal (for advanced usage)
export { RLMCache, getGlobalCache, clearGlobalCache } from "./cache";
export { BudgetManager } from "./budget";
export { runPlanner } from "./planner";
export { executeWorker } from "./worker";
export { aggregateResults } from "./aggregator";

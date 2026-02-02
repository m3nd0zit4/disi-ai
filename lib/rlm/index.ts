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
  // Streaming types
  StreamChunkCallback,
  StreamStatusCallback,
  StreamStatus,
  StreamingOptions,
  RLMStreamPhase,
  RLMProgress,
} from "./types";

export { DEFAULT_RLM_CONFIG, DEFAULT_STREAMING_OPTIONS } from "./types";

// Core components
export { RLMOrchestrator, executeRLM, executeRLMStreaming } from "./orchestrator";
export { executeSimpleRLM, executeSimpleRLMStreaming } from "./simple-rlm";

// Stream processing
export { StreamProcessor, normalizeStream, type NormalizedChunk } from "./stream-normalizer";

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
export { aggregateResults, aggregateResultsStreaming } from "./aggregator";

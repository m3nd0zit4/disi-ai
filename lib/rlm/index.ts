/**
 * RLM Module - Public API
 *
 * Structure:
 * - types.ts       Shared types
 * - core/          Orchestrator + Simple RLM (entry points)
 * - streaming/     StreamProcessor (consumes AI SDK stream via mapAISDKStreamToChunks)
 * - full/          Planner, Worker, Aggregator (recursive mode)
 * - internal/      Cache, Budget, Model resolver, Environment
 */

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
  StreamChunkCallback,
  StreamStatusCallback,
  StreamStatus,
  StreamingOptions,
  RLMStreamPhase,
  RLMProgress,
  ToolEvent,
} from "./types";

export { DEFAULT_RLM_CONFIG, DEFAULT_STREAMING_OPTIONS } from "./types";

export {
  RLMOrchestrator,
  executeRLM,
  executeRLMStreaming,
  type OrchestratorOptions,
  type StreamingOrchestratorOptions,
} from "./core/orchestrator";

export { executeSimpleRLM, executeSimpleRLMStreaming, type SimpleRLMOptions } from "./core/simple-rlm";

export {
  StreamProcessor,
  type NormalizedChunk,
  type StreamCitation,
} from "./streaming";

export {
  PromptEnvironment,
  createEnvironment,
  createEnvironmentFromContext,
  type PromptSlice,
  type QueryResult,
  type EnvironmentConfig,
} from "./internal";

export { RLMCache, getGlobalCache, clearGlobalCache } from "./internal";
export { BudgetManager } from "./internal";
export { runPlanner } from "./full/planner";
export { executeWorker } from "./full/worker";
export { aggregateResults, aggregateResultsStreaming } from "./full/aggregator";

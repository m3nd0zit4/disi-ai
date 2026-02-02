/**
 * RLM (Recursive Language Models) Type Definitions
 * 
 * Two modes:
 * - Simple: No sub-calls, single LLM invocation
 * - Full: Recursive with planner → workers → aggregator
 */

// =============================================================================
// Mode & Configuration
// =============================================================================

export type RLMMode = "simple" | "full";

export interface RLMConfig {
  /** Execution mode */
  mode: RLMMode;
  /** Max recursion depth (Full mode only). Non-negotiable: 3 */
  maxDepth: number;
  /** Max child calls per depth (Full mode only). Non-negotiable: 5 */
  maxChildCalls: number;
  /** Token budget for entire execution */
  tokenBudget: number;
  /** Enable result caching */
  enableCache: boolean;
  /** Include reasoning summary in output */
  enableReasoning: boolean;
  /** Model to use for LLM calls */
  modelId?: string;
  /** Provider for LLM calls */
  provider?: string;
}

export const DEFAULT_RLM_CONFIG: RLMConfig = {
  mode: "simple",
  maxDepth: 3,
  maxChildCalls: 5,
  tokenBudget: 16000,
  enableCache: true,
  enableReasoning: false,
};

// =============================================================================
// Execution State
// =============================================================================

export interface RLMExecutionState {
  /** Current recursion depth */
  depth: number;
  /** Number of child calls made at current depth */
  childCallCount: number;
  /** Total tokens consumed */
  tokensUsed: number;
  /** Cache hits during execution */
  cacheHits: number;
  /** Whether execution stopped early */
  stoppedEarly: boolean;
  /** Reason for early stop */
  stopReason?: string;
}

// =============================================================================
// Sub-Query (Full Mode)
// =============================================================================

export interface SubQueryProposal {
  /** The focused question to answer */
  query: string;
  /** Why this sub-query is needed */
  rationale: string;
  /** Priority 1-5 (1 = highest) */
  priority: number;
  /** Optional: specific context filter */
  contextFilter?: ContextSliceSpec;
}

export interface PlannerResult {
  /** Whether sub-queries are needed */
  needsSubQueries: boolean;
  /** Proposed sub-queries (max 5) */
  subQueries: SubQueryProposal[];
  /** If true, planner can answer directly */
  canAnswerDirectly: boolean;
  /** Direct answer if canAnswerDirectly */
  directAnswer?: string;
  /** Tokens used for this call */
  tokensUsed: number;
}

// =============================================================================
// Worker Result
// =============================================================================

export interface WorkerResult {
  /** The answer to the focused question */
  answer: string;
  /** Confidence 0-1 */
  confidence: number;
  /** The query that was answered */
  sourceQuery: string;
  /** Tokens used for this call */
  tokensUsed: number;
  /** Whether from cache */
  fromCache: boolean;
}

// =============================================================================
// Context Slicing
// =============================================================================

export interface ContextSliceSpec {
  /** Filter by semantic roles */
  roles?: string[];
  /** Filter by node types */
  nodeTypes?: string[];
  /** Character range */
  range?: { start: number; end: number };
  /** Keyword filter */
  keywords?: string[];
}

// =============================================================================
// Output
// =============================================================================

export interface RLMOutput {
  /** Main content */
  content: {
    markdown: string;
  };
  /** Optional reasoning transparency */
  reasoning?: {
    summary: string;
    type: "model" | "proxy";
  };
  /** Execution metadata */
  metadata?: {
    mode: RLMMode;
    depthUsed: number;
    subCalls: number;
    cacheHits: number;
    tokensUsed: number;
  };
}

// =============================================================================
// Streaming Support
// =============================================================================

/** Callback for streaming text chunks */
export type StreamChunkCallback = (chunk: string) => void | Promise<void>;

/** Callback for streaming status updates */
export type StreamStatusCallback = (status: StreamStatus) => void | Promise<void>;

/** RLM execution phases for streaming */
export type RLMStreamPhase =
  | "thinking"      // Initial thinking (simple mode)
  | "planning"      // Planner is analyzing query (full mode)
  | "researching"   // Workers are answering sub-queries (full mode)
  | "synthesizing"  // Aggregator is combining results (full mode)
  | "streaming"     // Final response is being streamed
  | "complete"      // Execution finished
  | "error";        // Error occurred

/** Progress information for full RLM mode */
export interface RLMProgress {
  /** Current step in the process */
  currentStep: number;
  /** Total steps expected */
  totalSteps: number;
  /** Description of current activity */
  stepDescription: string;
  /** Sub-queries being processed */
  subQueries?: string[];
  /** Current worker index (1-based) */
  currentWorker?: number;
  /** Total workers */
  totalWorkers?: number;
}

/** Stream status for UI updates */
export interface StreamStatus {
  /** Current phase of execution */
  phase: RLMStreamPhase;
  /** Accumulated text so far */
  currentText: string;
  /** Reasoning/thinking content (if separate from main response) */
  thinkingContent?: string;
  /** Estimated tokens so far */
  tokensUsed: number;
  /** Whether this is a final update */
  isFinal: boolean;
  /** Error message if phase is "error" */
  error?: string;
  /** Progress info for full RLM mode */
  progress?: RLMProgress;
}

/** Options for streaming execution */
export interface StreamingOptions {
  /** Enable streaming (default: true) */
  enabled: boolean;
  /** Callback for each text chunk */
  onChunk?: StreamChunkCallback;
  /** Callback for status updates */
  onStatus?: StreamStatusCallback;
  /** Batch size for Convex updates (chars) - reduces update frequency */
  batchSize?: number;
  /** Minimum interval between status updates (ms) */
  updateInterval?: number;
}

export const DEFAULT_STREAMING_OPTIONS: StreamingOptions = {
  enabled: true,
  batchSize: 50, // Send updates every 50 chars
  updateInterval: 100, // Or every 100ms, whichever comes first
};

// =============================================================================
// Cache
// =============================================================================

export interface CachedResult {
  result: WorkerResult;
  timestamp: number;
  hash: string;
}

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
// Cache
// =============================================================================

export interface CachedResult {
  result: WorkerResult;
  timestamp: number;
  hash: string;
}

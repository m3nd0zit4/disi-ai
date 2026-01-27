/**
 * AI Model System - Main Entry Point
 *
 * Sistema de modelos de IA organizado por capacidades.
 *
 * @architecture
 * ```
 * [ UI / UX Layer ]
 *       ↓
 * [ Modes Layer ]        ← Smart, Fast, Creative, etc.
 *       ↓
 * [ Capability Layer ]   ← text.chat, image.generation, etc.
 *       ↓
 * [ Model Registry ]     ← Fuente única de verdad
 *       ↓
 * [ Provider Adapters ]  ← OpenAI, Anthropic, Google, etc.
 * ```
 *
 * @example Basic usage
 * ```typescript
 * import { modelRegistry, resolveMode } from "@/shared/ai";
 *
 * // Get model by ID
 * const model = modelRegistry.getById("claude-sonnet-4-5");
 *
 * // Get models by capability
 * const reasoningModels = modelRegistry.getByCapability("text.reasoning");
 *
 * // Resolve a user mode to a model
 * const selection = resolveMode("smart");
 * console.log(selection.modelId); // "claude-sonnet-4-5"
 * ```
 *
 * @example Advanced queries
 * ```typescript
 * import { modelRegistry } from "@/shared/ai";
 *
 * // Get recommended model for a capability
 * const best = modelRegistry.getRecommendedFor("text.coding");
 *
 * // Get fastest model for a capability
 * const fastest = modelRegistry.getFastestFor("text.chat");
 *
 * // Query with filters
 * const results = modelRegistry.query({
 *   capabilities: ["text.reasoning"],
 *   costTiers: ["low", "medium"],
 *   enabled: true,
 * });
 * ```
 *
 * @example UI integration
 * ```typescript
 * import { getEnabledModes, resolveMode } from "@/shared/ai";
 *
 * // Get modes for selector
 * const modes = getEnabledModes();
 *
 * // When user selects a mode
 * const selection = resolveMode("smart", { hasPremium: user.isPremium });
 * // Use selection.modelId for API calls
 * ```
 *
 * @date 2026-01-25
 */

// =============================================================================
// CAPABILITIES
// =============================================================================

export {
  type ModelCapability,
  type CapabilityCategory,
  type CapabilityInfo,
  CAPABILITY_INFO,
  getCapabilityCategory,
  getCapabilitiesByCategory,
} from "./capabilities";

// =============================================================================
// REGISTRY
// =============================================================================

export {
  // Main registry instance
  modelRegistry,
  ModelRegistry,

  // Types
  type RegisteredModel,
  type Provider,
  type CostTier,
  type SpeedTier,
  type InputModality,
  type OutputModality,
  type ModelFeatures,
  type ModelTools,
  type ModelFilters,
  type ModelSortOptions,

  // Constants
  PROVIDER_INFO,
  PROVIDER_LEGACY_MAP,
  SPEED_ORDER,
  COST_ORDER,

  // Adapter (for advanced use)
  adaptLegacyModel,
  getAdaptedModels,
  getModelsForUI,
  registeredModelToLegacy,
} from "./registry";

// =============================================================================
// MODES
// =============================================================================

export {
  // Resolution
  resolveMode,
  resolveModes,
  suggestModeForTask,

  // Configuration
  getModeConfig,
  getEnabledModes,
  getModesByTag,
  getRecommendedMode,
  getFreeModes,
  MODE_CONFIGS,
  DEFAULT_MODE_SETTINGS,

  // Types
  type UserMode,
  type ModeConfig,
  type ModeSelection,
  type ModeSettings,
} from "./modes";

// =============================================================================
// UTILITIES
// =============================================================================

export {
  // Cost calculation
  calculateTokenCost,
  calculateImageCost,
  calculateVideoCost,
  calculateTotalCost,
  estimateCostFromText,
  compareModelCosts,
  formatCost,
  type TokenUsage,
  type ImageGenerationUsage,
  type VideoGenerationUsage,
  type UsageCost,

  // Model helpers
  getBestModelFor,
  getMultimodalModels,
  canHandleFile,
  groupByProvider,
  groupByPrimaryCapability,
  groupByCostTier,
  compareModels,
  validateModel,
  validateModelCapabilities,
} from "./utils";

// =============================================================================
// REACT HOOKS
// =============================================================================

export {
  useModelRegistry,
  useModes,
  type UseModelRegistryReturn,
  type UseModesOptions,
  type UseModesReturn,
} from "./hooks";

// =============================================================================
// MODELS
// =============================================================================

export {
  // By capability
  TEXT_REASONING_MODELS,
  TEXT_STANDARD_MODELS,
  TEXT_MODELS,
  IMAGE_GENERATION_MODELS,
  VIDEO_GENERATION_MODELS,
  VISUAL_MODELS,

  // Combined (backward compatible)
  SPECIALIZED_MODELS,
} from "./models";

// =============================================================================
// TOOLS
// =============================================================================

export {
  // Types
  type BaseToolInfo,
  type UniversalToolId,
  type ToolCategory,

  // Provider tools
  type ClaudeToolId,
  type ClaudeToolInfo,
  CLAUDE_TOOLS_INFO,

  type OpenAIToolId,
  type OpenAIToolInfo,
  OPENAI_TOOLS_INFO,

  type GeminiToolId,
  type GeminiAgentId,
  type GeminiToolInfo,
  GEMINI_TOOLS_INFO,
  GEMINI_AGENTS_INFO,

  type GrokToolId,
  type GrokToolInfo,
  GROK_TOOLS_INFO,

  // All tools combined
  ALL_TOOLS_INFO,
} from "./tools";

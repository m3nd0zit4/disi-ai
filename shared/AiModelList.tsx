/**
 * AI Model List - Backward Compatibility Export
 *
 * This file provides backward compatibility for code that imports from @/shared/AiModelList.
 * New code should import directly from @/shared/ai.
 *
 * @deprecated Use @/shared/ai instead
 * @date 2026-01-25
 */

// Re-export everything from the new architecture
export {
    // Models
    SPECIALIZED_MODELS,
    TEXT_REASONING_MODELS,
    TEXT_STANDARD_MODELS,
    TEXT_MODELS,
    IMAGE_GENERATION_MODELS,
    VIDEO_GENERATION_MODELS,
    VISUAL_MODELS,

    // Registry
    modelRegistry,
    getAdaptedModels,
    getModelsForUI,

    // Modes
    resolveMode,
    getEnabledModes,
    useModes,
    useModelRegistry,

    // Types
    type RegisteredModel,
    type UserMode,
    type ModeConfig,
} from "@/shared/ai";

// Default export for backward compatibility
import { SPECIALIZED_MODELS } from "@/shared/ai";
export default SPECIALIZED_MODELS;
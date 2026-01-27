/**
 * User Modes Layer
 *
 * Exporta todo lo relacionado con modos de usuario.
 *
 * @example
 * ```typescript
 * import { resolveMode, getEnabledModes } from "@/shared/ai/modes";
 *
 * // Get available modes for UI
 * const modes = getEnabledModes();
 *
 * // Resolve mode to model
 * const selection = resolveMode("smart");
 * console.log(selection.modelId); // "claude-sonnet-4-5"
 * ```
 *
 * @date 2026-01-25
 */

import { modelRegistry } from "../registry";
import {
  UserMode,
  ModeConfig,
  ModeSelection,
  ModeSettings,
} from "./types";
import {
  getModeConfig,
  getEnabledModes,
  getModesByTag,
  getRecommendedMode,
  getFreeModes,
  DEFAULT_MODE_SETTINGS,
  MODE_CONFIGS,
} from "./mappings";

// =============================================================================
// MODE RESOLUTION
// =============================================================================

/**
 * Resuelve un modo a un modelo específico
 *
 * Intenta usar el modelo por defecto, si no está disponible
 * usa los fallbacks en orden.
 *
 * @param mode - El modo de usuario
 * @param options - Opciones adicionales
 * @returns La selección resuelta con modelo y settings
 */
export function resolveMode(
  mode: UserMode,
  options?: {
    /** Forzar un modelo específico en lugar del default */
    forceModelId?: string;
    /** Override de settings */
    settingsOverride?: Partial<ModeSettings>;
    /** Si el usuario tiene premium */
    hasPremium?: boolean;
  }
): ModeSelection {
  const config = getModeConfig(mode);

  // If forcing a specific model
  if (options?.forceModelId) {
    const model = modelRegistry.getById(options.forceModelId);
    if (model && model.enabled) {
      return {
        mode,
        modelId: options.forceModelId,
        settings: {
          ...config.recommendedSettings,
          ...options?.settingsOverride,
        },
      };
    }
  }

  // Try default model
  const defaultModel = modelRegistry.getById(config.defaultModelId);
  if (defaultModel && defaultModel.enabled) {
    // Check premium requirement
    if (!defaultModel.requiresPremium || options?.hasPremium) {
      return {
        mode,
        modelId: config.defaultModelId,
        settings: {
          ...config.recommendedSettings,
          ...options?.settingsOverride,
        },
      };
    }
  }

  // Try fallbacks
  for (const fallbackId of config.fallbackModelIds) {
    const fallbackModel = modelRegistry.getById(fallbackId);
    if (fallbackModel && fallbackModel.enabled) {
      if (!fallbackModel.requiresPremium || options?.hasPremium) {
        return {
          mode,
          modelId: fallbackId,
          settings: {
            ...config.recommendedSettings,
            ...options?.settingsOverride,
          },
        };
      }
    }
  }

  // Last resort: find any enabled model with the prioritized capabilities
  for (const capability of config.prioritizedCapabilities) {
    const recommended = modelRegistry.getRecommendedFor(capability);
    if (recommended) {
      return {
        mode,
        modelId: recommended.id,
        settings: {
          ...DEFAULT_MODE_SETTINGS,
          ...options?.settingsOverride,
        },
      };
    }
  }

  // Ultimate fallback: first enabled model
  const anyModel = modelRegistry.getEnabled()[0];
  return {
    mode,
    modelId: anyModel?.id || config.defaultModelId,
    settings: {
      ...DEFAULT_MODE_SETTINGS,
      ...options?.settingsOverride,
    },
  };
}

/**
 * Resuelve múltiples modos a sus modelos
 */
export function resolveModes(
  modes: UserMode[],
  options?: Parameters<typeof resolveMode>[1]
): ModeSelection[] {
  return modes.map((mode) => resolveMode(mode, options));
}

/**
 * Obtiene el mejor modo para una tarea específica
 */
export function suggestModeForTask(task: string): UserMode {
  const lowerTask = task.toLowerCase();

  // Coding keywords
  if (
    lowerTask.includes("code") ||
    lowerTask.includes("program") ||
    lowerTask.includes("function") ||
    lowerTask.includes("debug") ||
    lowerTask.includes("api")
  ) {
    return "code";
  }

  // Research keywords
  if (
    lowerTask.includes("research") ||
    lowerTask.includes("analyze") ||
    lowerTask.includes("compare") ||
    lowerTask.includes("study")
  ) {
    return "research";
  }

  // Creative keywords
  if (
    lowerTask.includes("write") ||
    lowerTask.includes("story") ||
    lowerTask.includes("creative") ||
    lowerTask.includes("brainstorm")
  ) {
    return "creative";
  }

  // Vision keywords
  if (
    lowerTask.includes("image") ||
    lowerTask.includes("photo") ||
    lowerTask.includes("picture") ||
    lowerTask.includes("see")
  ) {
    return "vision";
  }

  // Generation keywords
  if (
    lowerTask.includes("generate") ||
    lowerTask.includes("create image") ||
    lowerTask.includes("make video")
  ) {
    return "generate";
  }

  // Precise keywords
  if (
    lowerTask.includes("exact") ||
    lowerTask.includes("accurate") ||
    lowerTask.includes("fact")
  ) {
    return "precise";
  }

  // Quick keywords
  if (
    lowerTask.includes("quick") ||
    lowerTask.includes("fast") ||
    lowerTask.includes("simple")
  ) {
    return "fast";
  }

  // Default to smart
  return "smart";
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Types
  type UserMode,
  type ModeConfig,
  type ModeSelection,
  type ModeSettings,
} from "./types";

export {
  // Mappings
  MODE_CONFIGS,
  getModeConfig,
  getEnabledModes,
  getModesByTag,
  getRecommendedMode,
  getFreeModes,
  DEFAULT_MODE_SETTINGS,
} from "./mappings";

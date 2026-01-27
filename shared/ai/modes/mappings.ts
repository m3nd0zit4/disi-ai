/**
 * Mode Mappings
 *
 * Define qué modelo usar para cada modo de usuario.
 * Esta es la configuración central que conecta la UX con los modelos.
 *
 * @architecture-decision
 * Para cambiar qué modelo usa un modo, solo hay que modificar este archivo.
 * La UI y el resto del sistema permanecen sin cambios.
 *
 * @date 2026-01-25
 */

import { ModeConfig, UserMode, ModeSettings } from "./types";

/**
 * Configuración completa de todos los modos
 */
export const MODE_CONFIGS: Record<UserMode, ModeConfig> = {
  // ===========================================================================
  // SMART MODE - Balance between quality and speed (recommended)
  // ===========================================================================
  smart: {
    id: "smart",
    displayName: "Smart",
    description: "Best balance of quality and speed",
    icon: "sparkles",
    isRecommended: true,
    requiresPremium: false,
    enabled: true,
    defaultModelId: "claude-sonnet-4-5",
    fallbackModelIds: ["gpt-5.2", "gemini-2.5-flash", "grok-4"],
    prioritizedCapabilities: ["text.reasoning", "text.chat", "text.coding"],
    recommendedSettings: {
      temperature: 0.7,
      maxTokens: 4096,
    },
    tags: ["general", "recommended", "balanced"],
  },

  // ===========================================================================
  // FAST MODE - Prioritize speed over quality
  // ===========================================================================
  fast: {
    id: "fast",
    displayName: "Fast",
    description: "Quick responses for simple tasks",
    icon: "zap",
    isRecommended: false,
    requiresPremium: false,
    enabled: true,
    defaultModelId: "claude-haiku-4-5",
    fallbackModelIds: ["gpt-5-nano", "gemini-2.5-flash-lite", "grok-3-mini"],
    prioritizedCapabilities: ["text.chat"],
    recommendedSettings: {
      temperature: 0.5,
      maxTokens: 2048,
    },
    tags: ["quick", "simple", "efficient"],
  },

  // ===========================================================================
  // CREATIVE MODE - For creative and generative tasks
  // ===========================================================================
  creative: {
    id: "creative",
    displayName: "Creative",
    description: "Imaginative and diverse outputs",
    icon: "palette",
    isRecommended: false,
    requiresPremium: false,
    enabled: true,
    defaultModelId: "claude-sonnet-4-5",
    fallbackModelIds: ["gpt-5.2", "gemini-3-pro-preview"],
    prioritizedCapabilities: ["text.chat", "text.reasoning"],
    recommendedSettings: {
      temperature: 1.0,
      maxTokens: 4096,
      topP: 0.95,
    },
    tags: ["creative", "writing", "brainstorming"],
  },

  // ===========================================================================
  // PRECISE MODE - For analytical and precise tasks
  // ===========================================================================
  precise: {
    id: "precise",
    displayName: "Precise",
    description: "Accurate and factual responses",
    icon: "target",
    isRecommended: false,
    requiresPremium: true,
    enabled: true,
    defaultModelId: "claude-opus-4-5",
    fallbackModelIds: ["gpt-5.2-pro", "gemini-3-pro-preview", "deepseek-reasoner"],
    prioritizedCapabilities: ["text.reasoning", "text.analysis"],
    recommendedSettings: {
      temperature: 0.3,
      maxTokens: 8192,
      topP: 0.9,
    },
    tags: ["analytical", "factual", "precise"],
  },

  // ===========================================================================
  // RESEARCH MODE - For deep research and analysis
  // ===========================================================================
  research: {
    id: "research",
    displayName: "Research",
    description: "Deep analysis and comprehensive research",
    icon: "search",
    isRecommended: false,
    requiresPremium: true,
    enabled: true,
    defaultModelId: "claude-opus-4-5",
    fallbackModelIds: ["gpt-5.2-pro", "deepseek-reasoner"],
    prioritizedCapabilities: ["text.reasoning", "text.analysis", "text.summarization"],
    recommendedSettings: {
      temperature: 0.5,
      maxTokens: 16384,
    },
    tags: ["research", "analysis", "comprehensive"],
  },

  // ===========================================================================
  // CODE MODE - Optimized for coding tasks
  // ===========================================================================
  code: {
    id: "code",
    displayName: "Code",
    description: "Optimized for programming tasks",
    icon: "code",
    isRecommended: false,
    requiresPremium: false,
    enabled: true,
    defaultModelId: "claude-sonnet-4-5",
    fallbackModelIds: ["gpt-5.2", "deepseek-chat", "gemini-2.5-flash"],
    prioritizedCapabilities: ["text.coding", "text.reasoning"],
    recommendedSettings: {
      temperature: 0.2,
      maxTokens: 8192,
    },
    tags: ["coding", "programming", "development"],
  },

  // ===========================================================================
  // VISION MODE - For image understanding
  // ===========================================================================
  vision: {
    id: "vision",
    displayName: "Vision",
    description: "Understand and analyze images",
    icon: "eye",
    isRecommended: false,
    requiresPremium: false,
    enabled: true,
    defaultModelId: "claude-sonnet-4-5",
    fallbackModelIds: ["gpt-5.2", "gemini-3-pro-preview"],
    prioritizedCapabilities: ["image.understanding", "multimodal"],
    recommendedSettings: {
      temperature: 0.5,
      maxTokens: 4096,
    },
    tags: ["vision", "images", "multimodal"],
  },

  // ===========================================================================
  // GENERATE MODE - For content generation (images/video)
  // ===========================================================================
  generate: {
    id: "generate",
    displayName: "Generate",
    description: "Create images and videos",
    icon: "wand",
    isRecommended: false,
    requiresPremium: false,
    enabled: true,
    defaultModelId: "gpt-image-1.5",
    fallbackModelIds: ["gemini-3-pro-image-preview", "dall-e-3"],
    prioritizedCapabilities: ["image.generation", "video.generation"],
    recommendedSettings: {},
    tags: ["generation", "images", "videos", "creative"],
  },
};

/**
 * Obtiene la configuración de un modo
 */
export function getModeConfig(mode: UserMode): ModeConfig {
  return MODE_CONFIGS[mode];
}

/**
 * Obtiene todos los modos habilitados
 */
export function getEnabledModes(): ModeConfig[] {
  return Object.values(MODE_CONFIGS).filter((m) => m.enabled);
}

/**
 * Obtiene modos por tag
 */
export function getModesByTag(tag: string): ModeConfig[] {
  return Object.values(MODE_CONFIGS).filter(
    (m) => m.enabled && m.tags.includes(tag)
  );
}

/**
 * Obtiene el modo recomendado
 */
export function getRecommendedMode(): ModeConfig {
  return Object.values(MODE_CONFIGS).find((m) => m.isRecommended) || MODE_CONFIGS.smart;
}

/**
 * Obtiene modos que no requieren premium
 */
export function getFreeModes(): ModeConfig[] {
  return Object.values(MODE_CONFIGS).filter(
    (m) => m.enabled && !m.requiresPremium
  );
}

/**
 * Default settings cuando no hay configuración específica
 */
export const DEFAULT_MODE_SETTINGS: ModeSettings = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

/**
 * Provider Optimal Configurations
 *
 * This file contains optimal configurations for each AI provider and model,
 * including settings for web search, thinking/reasoning, and token limits.
 */

/**
 * Map legacy provider names to normalized names
 */
const PROVIDER_LEGACY_MAP: Record<string, string> = {
  "claude": "anthropic",
  "gpt": "openai",
  "gemini": "google",
  "grok": "xai",
  "deepseek": "deepseek",
};

/**
 * Normalize provider name
 */
function normalizeProvider(provider: string): string {
  const normalized = provider.toLowerCase();
  return PROVIDER_LEGACY_MAP[normalized] || normalized;
}

export const PROVIDER_OPTIMAL_CONFIGS = {
  anthropic: {
    "claude-sonnet-4-5-20250929": {
      maxTokens: 8000,
      temperature: 0.7,
      thinking: {
        enabled: true,
        budgetTokens: 10000,
      },
      webSearch: {
        enabled: true,
        maxUses: 5,
      },
    },
    "claude-opus-4-5-20251101": {
      maxTokens: 8000,
      temperature: 0.7,
      thinking: {
        enabled: true,
        budgetTokens: 16000,
      },
      webSearch: {
        enabled: true,
        maxUses: 5,
      },
    },
    "claude-haiku-4-5-20251001": {
      maxTokens: 4000,
      temperature: 0.7,
      thinking: {
        enabled: true,
        budgetTokens: 5000,
      },
      webSearch: {
        enabled: true,
        maxUses: 3,
      },
    },
    "claude-opus-4-1-20250805": {
      maxTokens: 8000,
      temperature: 0.7,
      thinking: {
        enabled: true,
        budgetTokens: 16000,
      },
      webSearch: {
        enabled: true,
        maxUses: 5,
      },
    },
    "claude-sonnet-4-20250514": {
      maxTokens: 8000,
      temperature: 0.7,
      thinking: {
        enabled: true,
        budgetTokens: 10000,
      },
      webSearch: {
        enabled: true,
        maxUses: 5,
      },
    },
  },

  openai: {
    "gpt-5.2": {
      maxTokens: 16000,
      reasoning: {
        enabled: true,
        effort: "medium" as const,
      },
      webSearch: {
        enabled: true,
      },
    },
    "gpt-5": {
      maxTokens: 16000,
      reasoning: {
        enabled: true,
        effort: "medium" as const,
      },
      webSearch: {
        enabled: true,
      },
    },
    "gpt-5-nano": {
      maxTokens: 8000,
      temperature: 0.7,
      webSearch: {
        enabled: true,
      },
    },
    "o4-mini": {
      maxTokens: 16000,
      reasoning: {
        enabled: true,
        effort: "medium" as const,
      },
    },
    "o3-mini": {
      maxTokens: 16000,
      reasoning: {
        enabled: true,
        effort: "medium" as const,
      },
    },
    "gpt-4o": {
      maxTokens: 8000,
      temperature: 0.7,
      webSearch: {
        enabled: true,
      },
    },
    "gpt-4o-mini": {
      maxTokens: 8000,
      temperature: 0.7,
      webSearch: {
        enabled: true,
      },
    },
    "gpt-4": {
      maxTokens: 8000,
      temperature: 0.7,
    },
  },

  google: {
    "gemini-3-flash-preview": {
      maxTokens: 8000,
      temperature: 0.7,
      thinking: {
        enabled: true,
        level: "medium" as const,
      },
      googleSearch: {
        enabled: true,
      },
    },
    "gemini-3-pro-preview": {
      maxTokens: 8000,
      temperature: 0.7,
      thinking: {
        enabled: true,
        level: "high" as const,
      },
      googleSearch: {
        enabled: true,
      },
    },
    "gemini-2.5-flash": {
      maxTokens: 8000,
      temperature: 0.7,
      thinking: {
        enabled: true,
        level: "medium" as const,
      },
      googleSearch: {
        enabled: true,
      },
    },
    "gemini-2.5-flash-preview-09-2025": {
      maxTokens: 8000,
      temperature: 0.7,
      thinking: {
        enabled: true,
        level: "medium" as const,
      },
      googleSearch: {
        enabled: true,
      },
    },
    "gemini-2.0-flash-exp": {
      maxTokens: 8000,
      temperature: 0.7,
      thinking: {
        enabled: true,
        level: "medium" as const,
      },
      googleSearch: {
        enabled: true,
      },
    },
    "gemini-1.5-pro": {
      maxTokens: 8000,
      temperature: 0.7,
      googleSearch: {
        enabled: true,
      },
    },
    "gemini-1.5-flash": {
      maxTokens: 8000,
      temperature: 0.7,
      googleSearch: {
        enabled: true,
      },
    },
  },

  xai: {
    "grok-4-1-fast-reasoning": {
      maxTokens: 8192,
      temperature: 0.7,
      search: {
        webSearch: {
          enabled: true,
          enableImageUnderstanding: true,
        },
        xSearch: {
          enabled: true,
          enableImageUnderstanding: true,
          enableVideoUnderstanding: true,
        },
      },
      includeCitations: true,
    },
    "grok-4": {
      maxTokens: 8000,
      temperature: 0.7,
      search: {
        webSearch: {
          enabled: true,
          enableImageUnderstanding: true,
        },
        xSearch: {
          enabled: true,
          enableImageUnderstanding: true,
          enableVideoUnderstanding: true,
        },
      },
      includeCitations: true,
    },
    "grok-3": {
      maxTokens: 8000,
      temperature: 0.7,
    },
    "grok-3-mini": {
      maxTokens: 4000,
      temperature: 0.7,
    },
  },

  deepseek: {
    "deepseek-reasoner": {
      maxTokens: 32000,
      temperature: undefined, // No temperature for reasoning models
      thinking: {
        enabled: true,
      },
    },
    "deepseek-chat": {
      maxTokens: 8000,
      temperature: 0.7,
    },
  },
};

/**
 * Get optimal configuration for a specific provider and model
 */
export function getOptimalConfig(provider: string, modelId: string): any {
  const normalizedProvider = normalizeProvider(provider);
  const providerConfigs = PROVIDER_OPTIMAL_CONFIGS[normalizedProvider as keyof typeof PROVIDER_OPTIMAL_CONFIGS];
  if (!providerConfigs) return {};

  return providerConfigs[modelId as keyof typeof providerConfigs] || {};
}

/**
 * Check if a model supports web search.
 * Uses model-specific config when present; otherwise returns true for providers that
 * generally support search (anthropic, openai, google, xai) so built-in tools are enabled.
 */
export function supportsWebSearch(provider: string, modelId: string): boolean {
  const normalizedProvider = normalizeProvider(provider);
  const config = getOptimalConfig(provider, modelId);
  if (config && Object.keys(config).length > 0) {
    return !!(config.webSearch?.enabled || config.googleSearch?.enabled || config.search);
  }
  return ["anthropic", "openai", "google", "xai"].includes(normalizedProvider);
}

/**
 * Check if a model supports extended thinking/reasoning
 *
 * This checks the optimal configuration defined for the model.
 * Note: You can also check model.features.extendedThinking from the registry directly.
 */
export function supportsThinking(provider: string, modelId: string): boolean {
  const config = getOptimalConfig(provider, modelId);
  return !!(config.thinking?.enabled || config.reasoning?.enabled);
}

/**
 * Get recommended max tokens for a model
 */
export function getRecommendedMaxTokens(provider: string, modelId: string): number {
  const config = getOptimalConfig(provider, modelId);
  return config.maxTokens || 8000;
}

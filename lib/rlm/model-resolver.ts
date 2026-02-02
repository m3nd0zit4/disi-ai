/**
 * Model ID Resolver for RLM
 *
 * Converts user-facing model IDs (e.g., "claude-haiku-4-5") to
 * provider API model IDs (e.g., "claude-haiku-4-5-20251001").
 *
 * Also provides utilities to get the correct API key environment variable
 * and provider service name for each model.
 *
 * This is critical because the AI provider APIs expect specific
 * model identifiers that differ from the simplified IDs used in the UI.
 */

import { SPECIALIZED_MODELS } from "@/shared/ai/models";
import { SpecializedModel } from "@/types/AiModel";

/**
 * Maps provider names to their environment variable names for API keys.
 * This ensures consistent API key retrieval across the application.
 */
const PROVIDER_API_KEY_MAP: Record<string, string> = {
  "Claude": "ANTHROPIC_API_KEY",
  "GPT": "OPENAI_API_KEY",
  "Gemini": "GOOGLE_AI_API_KEY",
  "Grok": "XAI_API_KEY",
  "DeepSeek": "DEEPSEEK_API_KEY",
  // Lowercase aliases
  "claude": "ANTHROPIC_API_KEY",
  "anthropic": "ANTHROPIC_API_KEY",
  "gpt": "OPENAI_API_KEY",
  "openai": "OPENAI_API_KEY",
  "gemini": "GOOGLE_AI_API_KEY",
  "google": "GOOGLE_AI_API_KEY",
  "grok": "XAI_API_KEY",
  "xai": "XAI_API_KEY",
  "deepseek": "DEEPSEEK_API_KEY",
};

/**
 * Maps provider names to the service provider string expected by getAIService.
 */
const PROVIDER_SERVICE_MAP: Record<string, string> = {
  "Claude": "anthropic",
  "GPT": "openai",
  "Gemini": "google",
  "Grok": "xai",
  "DeepSeek": "deepseek",
  // Lowercase aliases for consistency
  "claude": "anthropic",
  "anthropic": "anthropic",
  "gpt": "openai",
  "openai": "openai",
  "gemini": "google",
  "google": "google",
  "grok": "xai",
  "xai": "xai",
  "deepseek": "deepseek",
};

// Build a lookup map for fast resolution
const modelIdMap = new Map<string, SpecializedModel>();
const providerIdMap = new Map<string, SpecializedModel>();

// Initialize maps on module load
console.log("[Model Resolver] Initializing model maps with", SPECIALIZED_MODELS.length, "models");
for (const model of SPECIALIZED_MODELS) {
  modelIdMap.set(model.id, model);
  if (model.providerModelId) {
    providerIdMap.set(model.providerModelId, model);
  }
}
console.log("[Model Resolver] Maps initialized:", {
  userFacingIds: modelIdMap.size,
  providerIds: providerIdMap.size,
});

/**
 * Resolve a model ID to its provider API model ID.
 *
 * This handles both user-facing IDs and already-correct provider IDs:
 * - "claude-haiku-4-5" → "claude-haiku-4-5-20251001"
 * - "gemini-2.5-flash" → "gemini-2.5-flash" (same in this case)
 * - "claude-haiku-4-5-20251001" → "claude-haiku-4-5-20251001" (passthrough)
 *
 * @param modelId - The model ID to resolve (user-facing or provider)
 * @returns The provider API model ID, or the original ID if not found
 */
export function resolveModelId(modelId: string | undefined): string {
  console.log("[Model Resolver] resolveModelId called with:", modelId);

  if (!modelId) {
    console.log("[Model Resolver] No modelId provided, using default gpt-4o");
    return "gpt-4o"; // Default fallback
  }

  // First, try to find by user-facing ID
  const modelByUserFacingId = modelIdMap.get(modelId);
  if (modelByUserFacingId) {
    const resolved = modelByUserFacingId.providerModelId || modelId;
    console.log("[Model Resolver] Found by user-facing ID:", {
      input: modelId,
      resolved,
      provider: modelByUserFacingId.provider,
    });
    return resolved;
  }

  // If not found, check if it's already a provider ID
  const modelByProviderId = providerIdMap.get(modelId);
  if (modelByProviderId) {
    console.log("[Model Resolver] Already a provider ID:", modelId);
    return modelId; // Already a valid provider ID
  }

  // Not found in registry - return as-is (might be a new/custom model)
  console.warn(`[Model Resolver] Model ID "${modelId}" not found in registry, using as-is`);
  console.warn("[Model Resolver] Available user-facing IDs:", Array.from(modelIdMap.keys()).join(", "));
  return modelId;
}

/**
 * Get the full model definition by ID (user-facing or provider).
 *
 * @param modelId - The model ID to look up
 * @returns The model definition or undefined if not found
 */
export function getModelById(modelId: string | undefined): SpecializedModel | undefined {
  if (!modelId) return undefined;

  return modelIdMap.get(modelId) || providerIdMap.get(modelId);
}

/**
 * Get the provider service name from a model ID or provider name.
 * Maps the model's provider field to the AI service provider string.
 *
 * @param modelIdOrProvider - The model ID or provider name to look up
 * @returns The provider string for getAIService (e.g., "anthropic", "openai", "google")
 */
export function getProviderFromModelId(modelIdOrProvider: string | undefined): string {
  if (!modelIdOrProvider) return "openai"; // Default

  // First check if it's a direct provider name
  if (PROVIDER_SERVICE_MAP[modelIdOrProvider]) {
    return PROVIDER_SERVICE_MAP[modelIdOrProvider];
  }

  // Try to find the model
  const model = getModelById(modelIdOrProvider);
  if (model) {
    return PROVIDER_SERVICE_MAP[model.provider] || "openai";
  }

  return "openai"; // Default
}

/**
 * Get the correct API key for a provider.
 * This handles the mapping between provider names and their environment variables.
 *
 * @param provider - The provider name (e.g., "Claude", "Gemini", "anthropic", "google")
 * @param fallbackApiKey - Optional API key to use if environment variable is not set
 * @returns The API key from the environment or the fallback
 */
export function getApiKeyForProvider(provider: string | undefined, fallbackApiKey?: string): string {
  console.log("[Model Resolver] getApiKeyForProvider called with:", {
    provider,
    hasFallbackApiKey: !!fallbackApiKey,
  });

  if (fallbackApiKey) {
    console.log("[Model Resolver] Using fallback API key");
    return fallbackApiKey;
  }

  if (!provider) {
    console.log("[Model Resolver] No provider, using OPENAI_API_KEY");
    const key = process.env.OPENAI_API_KEY || "";
    console.log("[Model Resolver] OPENAI_API_KEY found:", !!key);
    return key;
  }

  const envVarName = PROVIDER_API_KEY_MAP[provider] || PROVIDER_API_KEY_MAP[provider.toLowerCase()];
  console.log("[Model Resolver] Looking for env var:", envVarName);

  if (envVarName) {
    const key = process.env[envVarName] || "";
    console.log("[Model Resolver] API key found for", envVarName + ":", !!key, "length:", key.length);
    return key;
  }

  // Fallback: try the simple pattern
  const fallbackEnvVar = `${provider.toUpperCase()}_API_KEY`;
  console.log("[Model Resolver] Trying fallback env var:", fallbackEnvVar);
  const key = process.env[fallbackEnvVar] || "";
  console.log("[Model Resolver] Fallback API key found:", !!key);
  return key;
}

/**
 * Get the normalized provider name for getAIService from any provider string.
 *
 * @param provider - The provider name in any format
 * @returns The normalized provider string for getAIService
 */
export function normalizeProvider(provider: string | undefined): string {
  console.log("[Model Resolver] normalizeProvider called with:", provider);

  if (!provider) {
    console.log("[Model Resolver] No provider, defaulting to openai");
    return "openai";
  }

  const normalized = PROVIDER_SERVICE_MAP[provider] || PROVIDER_SERVICE_MAP[provider.toLowerCase()] || "openai";
  console.log("[Model Resolver] Normalized provider:", {
    input: provider,
    output: normalized,
  });
  return normalized;
}

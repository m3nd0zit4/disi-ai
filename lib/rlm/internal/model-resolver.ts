/**
 * Model ID Resolver for RLM
 *
 * Converts user-facing model IDs to provider API model IDs.
 * Provides API key env vars and provider service names.
 */

import { SPECIALIZED_MODELS } from "@/shared/ai/models";
import { SpecializedModel } from "@/types/AiModel";

const PROVIDER_API_KEY_MAP: Record<string, string> = {
  Claude: "ANTHROPIC_API_KEY",
  GPT: "OPENAI_API_KEY",
  Gemini: "GOOGLE_AI_API_KEY",
  Grok: "XAI_API_KEY",
  DeepSeek: "DEEPSEEK_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gpt: "OPENAI_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GOOGLE_AI_API_KEY",
  google: "GOOGLE_AI_API_KEY",
  grok: "XAI_API_KEY",
  xai: "XAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

const PROVIDER_SERVICE_MAP: Record<string, string> = {
  Claude: "anthropic",
  GPT: "openai",
  Gemini: "google",
  Grok: "xai",
  DeepSeek: "deepseek",
  claude: "anthropic",
  anthropic: "anthropic",
  gpt: "openai",
  openai: "openai",
  gemini: "google",
  google: "google",
  grok: "xai",
  xai: "xai",
  deepseek: "deepseek",
};

const modelIdMap = new Map<string, SpecializedModel>();
const providerIdMap = new Map<string, SpecializedModel>();

for (const model of SPECIALIZED_MODELS) {
  modelIdMap.set(model.id, model);
  if (model.providerModelId) providerIdMap.set(model.providerModelId, model);
}

/** First enabled text model in the registry; used when no model is configured (e.g. first open). */
function getDefaultModel(): SpecializedModel | undefined {
  return SPECIALIZED_MODELS.find((m) => m.enabled);
}

/** Default model ID for UI/selector when none is set. Always an ID that exists in SPECIALIZED_MODELS. */
export function getDefaultModelId(): string {
  const m = getDefaultModel();
  return m?.id ?? "gpt-5-nano";
}

/** Default provider model ID for API calls when none is set. */
export function getDefaultProviderModelId(): string {
  const m = getDefaultModel();
  return m?.providerModelId ?? m?.id ?? "gpt-5-nano";
}

export function resolveModelId(modelId: string | undefined): string {
  if (!modelId) return getDefaultProviderModelId();
  const byUser = modelIdMap.get(modelId);
  if (byUser) return byUser.providerModelId || modelId;
  if (providerIdMap.get(modelId)) return modelId;
  return modelId;
}

export function getModelById(modelId: string | undefined): SpecializedModel | undefined {
  if (!modelId) return undefined;
  return modelIdMap.get(modelId) || providerIdMap.get(modelId);
}

export function getProviderFromModelId(modelIdOrProvider: string | undefined): string {
  if (!modelIdOrProvider) return "openai";
  if (PROVIDER_SERVICE_MAP[modelIdOrProvider]) return PROVIDER_SERVICE_MAP[modelIdOrProvider];
  const model = getModelById(modelIdOrProvider);
  if (model) return PROVIDER_SERVICE_MAP[model.provider] || "openai";
  return "openai";
}

export function getApiKeyForProvider(provider: string | undefined, fallbackApiKey?: string): string {
  if (fallbackApiKey) return fallbackApiKey;
  if (!provider) return process.env.OPENAI_API_KEY || "";
  const envVar = PROVIDER_API_KEY_MAP[provider] || PROVIDER_API_KEY_MAP[provider.toLowerCase()];
  if (envVar) return process.env[envVar] || "";
  return process.env[`${provider.toUpperCase()}_API_KEY`] || "";
}

export function normalizeProvider(provider: string | undefined): string {
  if (!provider) return "openai";
  return PROVIDER_SERVICE_MAP[provider] || PROVIDER_SERVICE_MAP[provider.toLowerCase()] || "openai";
}

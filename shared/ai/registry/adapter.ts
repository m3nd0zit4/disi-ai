/**
 * Model Adapter
 *
 * Convierte los modelos del formato legacy (SpecializedModel) al nuevo
 * formato (RegisteredModel) sin modificar los archivos originales.
 *
 * @architecture-decision
 * Este adaptador permite una migración gradual. Los modelos existentes
 * siguen funcionando mientras se adopta la nueva arquitectura.
 *
 * @date 2026-01-25
 */

import { ModelCapability } from "../capabilities/types";
import {
  RegisteredModel,
  Provider,
  PROVIDER_LEGACY_MAP,
  CostTier,
  SpeedTier,
  ModelFeatures,
  ModelTools,
  DEFAULT_FEATURES,
  DEFAULT_TOOLS,
  InputModality,
  OutputModality,
} from "./types";

// Import models from new location
import { SPECIALIZED_MODELS } from "../models";
import { SpecializedModel } from "@/types/AiModel";

// =============================================================================
// CAPABILITY MAPPING
// =============================================================================

/**
 * Mapea la categoría legacy a capacidades del nuevo sistema
 */
function mapCategoryToCapabilities(
  model: SpecializedModel
): { capabilities: ModelCapability[]; primaryCapability: ModelCapability } {
  const category = model.category;
  const hasVision = model.providerMetadata?.metadata?.inputModalities?.includes("image");
  const hasAudio = model.providerMetadata?.metadata?.inputModalities?.includes("audio");
  const hasVideo = model.providerMetadata?.metadata?.inputModalities?.includes("video");

  switch (category) {
    case "reasoning": {
      const capabilities: ModelCapability[] = ["text.chat", "text.reasoning", "text.coding"];

      // Add multimodal if it supports multiple input types
      if (hasVision) capabilities.push("image.understanding");
      if (hasAudio) capabilities.push("audio.understanding");
      if (hasVideo) capabilities.push("video.understanding");
      if ((hasVision || hasAudio || hasVideo) && capabilities.length > 3) {
        capabilities.push("multimodal");
      }

      return { capabilities, primaryCapability: "text.reasoning" };
    }

    case "standard": {
      const capabilities: ModelCapability[] = ["text.chat"];

      if (hasVision) capabilities.push("image.understanding");

      return { capabilities, primaryCapability: "text.chat" };
    }

    case "image": {
      const capabilities: ModelCapability[] = ["image.generation"];

      // Check if it supports image editing
      const endpoints = (model.providerMetadata?.metadata as any)?.endpoints;
      if (endpoints?.imageEdit) {
        capabilities.push("image.editing");
      }

      // Check if it can also do text
      const outputModalities = model.providerMetadata?.metadata?.outputModalities;
      if (outputModalities?.includes("text")) {
        capabilities.push("text.chat");
      }

      return { capabilities, primaryCapability: "image.generation" };
    }

    case "video": {
      return {
        capabilities: ["video.generation"],
        primaryCapability: "video.generation",
      };
    }

    default:
      return {
        capabilities: ["text.chat"],
        primaryCapability: "text.chat",
      };
  }
}

// =============================================================================
// COST TIER MAPPING
// =============================================================================

/**
 * Determina el tier de costo basado en el pricing
 */
function determineCostTier(model: SpecializedModel): CostTier {
  const pricing = (model.providerMetadata?.metadata as any)?.pricing;

  if (!pricing) {
    return model.premium ? "high" : "medium";
  }

  const inputCost = pricing.inputPerMillion || 0;
  const outputCost = pricing.outputPerMillion || 0;

  // Calculate average cost
  const avgCost = (inputCost + outputCost) / 2;

  // Free tier
  if (avgCost === 0 && !model.premium) return "free";

  // Classify by cost ranges
  if (avgCost <= 0.5) return "low";
  if (avgCost <= 5) return "medium";
  if (avgCost <= 20) return "high";
  return "premium";
}

// =============================================================================
// SPEED TIER MAPPING
// =============================================================================

/**
 * Determina el tier de velocidad basado en características del modelo
 */
function determineSpeedTier(model: SpecializedModel): SpeedTier {
  const name = model.name.toLowerCase();
  const id = model.id.toLowerCase();
  const description = model.description.toLowerCase();

  // Fast indicators
  if (
    name.includes("haiku") ||
    name.includes("flash") ||
    name.includes("mini") ||
    name.includes("nano") ||
    name.includes("lite") ||
    name.includes("fast") ||
    description.includes("fastest") ||
    description.includes("fast")
  ) {
    return "fast";
  }

  // Slow indicators (large, premium reasoning models)
  if (
    name.includes("opus") ||
    name.includes("pro") ||
    id.includes("reasoner") ||
    (model.category === "video" && !name.includes("fast"))
  ) {
    return "slow";
  }

  // Medium for most reasoning models
  if (model.category === "reasoning") {
    return "medium";
  }

  return "medium";
}

// =============================================================================
// FEATURES MAPPING
// =============================================================================

/**
 * Extrae las features del modelo legacy
 */
function extractFeatures(model: SpecializedModel): ModelFeatures {
  const metadata = model.providerMetadata?.metadata as any;
  const features = metadata?.features || {};
  const capabilities = metadata?.capabilities || {};

  return {
    streaming: features.streaming ?? DEFAULT_FEATURES.streaming,
    functionCalling: features.functionCalling ?? DEFAULT_FEATURES.functionCalling,
    structuredOutputs: features.structuredOutputs ?? capabilities.structuredOutputs ?? DEFAULT_FEATURES.structuredOutputs,
    extendedThinking: features.extendedThinking ?? capabilities.thinking ?? DEFAULT_FEATURES.extendedThinking,
    promptCaching: features.promptCaching ?? DEFAULT_FEATURES.promptCaching,
    systemPrompts: features.systemPrompts ?? DEFAULT_FEATURES.systemPrompts,
  };
}

// =============================================================================
// TOOLS MAPPING
// =============================================================================

/**
 * Extrae las herramientas del modelo legacy
 */
function extractTools(model: SpecializedModel): ModelTools {
  const metadata = model.providerMetadata?.metadata as any;
  const tools = metadata?.tools || {};

  return {
    webSearch: tools.webSearch ?? tools.googleSearch ?? DEFAULT_TOOLS.webSearch,
    codeExecution: tools.codeInterpreter ?? tools.codeExecution ?? DEFAULT_TOOLS.codeExecution,
    fileSearch: tools.fileSearch ?? DEFAULT_TOOLS.fileSearch,
    computerUse: tools.computerUse ?? DEFAULT_TOOLS.computerUse,
    mcp: tools.mcp ?? DEFAULT_TOOLS.mcp,
    imageGeneration: tools.imageGeneration ?? DEFAULT_TOOLS.imageGeneration,
  };
}

// =============================================================================
// MODALITIES MAPPING
// =============================================================================

/**
 * Normaliza las modalidades de input
 */
function normalizeInputModalities(model: SpecializedModel): InputModality[] {
  const modalities = model.providerMetadata?.metadata?.inputModalities || ["text"];
  return modalities as InputModality[];
}

/**
 * Normaliza las modalidades de output
 */
function normalizeOutputModalities(model: SpecializedModel): OutputModality[] {
  const modalities = model.providerMetadata?.metadata?.outputModalities || ["text"];
  return modalities as OutputModality[];
}

// =============================================================================
// MAIN ADAPTER FUNCTION
// =============================================================================

/**
 * Convierte un SpecializedModel al nuevo formato RegisteredModel
 */
export function adaptLegacyModel(legacy: SpecializedModel): RegisteredModel {
  const { capabilities, primaryCapability } = mapCategoryToCapabilities(legacy);
  const metadata = legacy.providerMetadata?.metadata as any;

  // Map legacy provider name to new format
  const providerLegacy = legacy.provider;
  const provider: Provider = PROVIDER_LEGACY_MAP[providerLegacy] || (providerLegacy.toLowerCase() as Provider);

  return {
    // Identification
    id: legacy.id,
    providerModelId: legacy.providerModelId,
    provider,

    // Display
    displayName: legacy.name,
    description: legacy.description,
    icon: legacy.icon,

    // Capabilities
    capabilities,
    primaryCapability,

    // Modalities
    inputModalities: normalizeInputModalities(legacy),
    outputModalities: normalizeOutputModalities(legacy),

    // Classification
    costTier: determineCostTier(legacy),
    speedTier: determineSpeedTier(legacy),

    // Technical Limits
    contextWindow: metadata?.contextWindow || 0,
    maxOutputTokens: metadata?.maxOutputTokens || 0,
    knowledgeCutoff: metadata?.knowledgeCutoff,

    // Features & Tools
    features: extractFeatures(legacy),
    tools: extractTools(legacy),

    // Control
    enabled: legacy.enabled,
    requiresPremium: legacy.premium,
    isLegacy: isLegacyModel(legacy),
    deprecationDate: undefined,
    replacedBy: getReplacementModel(legacy),

    // Provider-specific metadata (preserved for backend use)
    _providerMetadata: {
      pricing: metadata?.pricing,
      endpoints: metadata?.endpoints,
      snapshots: metadata?.snapshots,
      imageGenerationOptions: metadata?.imageGenerationOptions,
      videoGenerationOptions: metadata?.videoGenerationOptions,
      // Preserve original for debugging
      _original: metadata,
    },
  };
}

/**
 * Determina si un modelo es legacy basado en su nombre/descripción
 */
function isLegacyModel(model: SpecializedModel): boolean {
  const indicators = ["legacy", "previous", "older", "deprecated"];
  const text = `${model.name} ${model.description}`.toLowerCase();
  return indicators.some((indicator) => text.includes(indicator));
}

/**
 * Determina el modelo de reemplazo para modelos legacy
 */
function getReplacementModel(model: SpecializedModel): string | undefined {
  // Mapeo de modelos legacy a sus reemplazos
  const replacementMap: Record<string, string> = {
    "claude-3-haiku": "claude-haiku-4-5",
    "claude-opus-4-1": "claude-opus-4-5",
    "claude-sonnet-4": "claude-sonnet-4-5",
    "grok-3": "grok-4",
    "gpt-5": "gpt-5.2",
  };

  return replacementMap[model.id];
}

// =============================================================================
// BULK CONVERSION
// =============================================================================

/**
 * Convierte todos los modelos legacy al nuevo formato
 */
export function adaptAllLegacyModels(): RegisteredModel[] {
  return SPECIALIZED_MODELS.map(adaptLegacyModel);
}

/**
 * Modelos ya adaptados (cache)
 */
let _adaptedModels: RegisteredModel[] | null = null;

/**
 * Obtiene todos los modelos adaptados (con cache)
 */
export function getAdaptedModels(): RegisteredModel[] {
  if (!_adaptedModels) {
    _adaptedModels = adaptAllLegacyModels();
  }
  return _adaptedModels;
}

/**
 * Invalida el cache de modelos adaptados
 * Útil para testing o hot-reload
 */
export function invalidateAdaptedModelsCache(): void {
  _adaptedModels = null;
}

// =============================================================================
// REVERSE CONVERSION (RegisteredModel -> SpecializedModel format)
// =============================================================================

/**
 * Convierte un RegisteredModel de vuelta al formato SpecializedModel
 * para mantener compatibilidad con componentes UI legacy
 */
export function registeredModelToLegacy(model: RegisteredModel): SpecializedModel {
  // Map provider back to legacy format
  const legacyProviderMap: Record<string, string> = {
    anthropic: "Claude",
    openai: "GPT",
    google: "Gemini",
    xai: "Grok",
    deepseek: "DeepSeek",
  };

  // Map primaryCapability to legacy category
  const categoryMap: Record<string, "reasoning" | "standard" | "image" | "video"> = {
    "text.reasoning": "reasoning",
    "text.chat": "standard",
    "text.coding": "reasoning",
    "image.generation": "image",
    "video.generation": "video",
  };

  const providerMeta = model._providerMetadata as Record<string, unknown> | undefined;

  return {
    id: model.id,
    providerModelId: model.providerModelId,
    provider: (legacyProviderMap[model.provider] || model.provider) as any,
    name: model.displayName,
    description: model.description,
    category: categoryMap[model.primaryCapability] || "standard",
    premium: model.requiresPremium,
    enabled: model.enabled,
    icon: model.icon,
    providerMetadata: providerMeta ? {
      provider: legacyProviderMap[model.provider] || model.provider,
      metadata: {
        ...(providerMeta._original as object || {}),
        pricing: providerMeta.pricing,
        endpoints: providerMeta.endpoints,
        imageGenerationOptions: providerMeta.imageGenerationOptions,
        videoGenerationOptions: providerMeta.videoGenerationOptions,
      }
    } as any : undefined,
  };
}

/**
 * Obtiene todos los modelos en formato legacy SpecializedModel
 * para compatibilidad con componentes UI
 */
let _legacyFormattedModels: SpecializedModel[] | null = null;

export function getModelsForUI(): SpecializedModel[] {
  if (!_legacyFormattedModels) {
    _legacyFormattedModels = getAdaptedModels().map(registeredModelToLegacy);
  }
  return _legacyFormattedModels;
}

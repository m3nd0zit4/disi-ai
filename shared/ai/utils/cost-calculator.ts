/**
 * Cost Calculator
 *
 * Calcula el costo de uso de modelos basado en tokens,
 * generación de imágenes, videos, etc.
 *
 * @date 2026-01-25
 */

import { modelRegistry, RegisteredModel } from "../registry";

// =============================================================================
// TYPES
// =============================================================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface ImageGenerationUsage {
  count: number;
  size: string;
  quality: string;
}

export interface VideoGenerationUsage {
  durationSeconds: number;
  resolution: string;
}

export interface UsageCost {
  inputCost: number;
  outputCost: number;
  cacheCost: number;
  imageCost: number;
  videoCost: number;
  totalCost: number;
  currency: "USD";
}

// =============================================================================
// COST CALCULATION
// =============================================================================

/**
 * Calcula el costo de tokens para un modelo
 */
export function calculateTokenCost(
  modelId: string,
  usage: TokenUsage
): UsageCost {
  const model = modelRegistry.getById(modelId);
  if (!model) {
    return createEmptyCost();
  }

  const pricing = model._providerMetadata?.pricing;
  if (!pricing) {
    return createEmptyCost();
  }

  const inputPerMillion = pricing.inputPerMillion || 0;
  const outputPerMillion = pricing.outputPerMillion || 0;
  const cachedPerMillion = pricing.cachedInputPerMillion || inputPerMillion;

  const inputCost = (usage.inputTokens / 1_000_000) * inputPerMillion;
  const outputCost = (usage.outputTokens / 1_000_000) * outputPerMillion;
  const cacheCost = ((usage.cachedInputTokens || 0) / 1_000_000) * cachedPerMillion;

  return {
    inputCost,
    outputCost,
    cacheCost,
    imageCost: 0,
    videoCost: 0,
    totalCost: inputCost + outputCost + cacheCost,
    currency: "USD",
  };
}

/**
 * Calcula el costo de generación de imágenes
 */
export function calculateImageCost(
  modelId: string,
  usage: ImageGenerationUsage
): UsageCost {
  const model = modelRegistry.getById(modelId);
  if (!model) {
    return createEmptyCost();
  }

  const pricing = model._providerMetadata?.pricing;
  const imageOptions = (model._providerMetadata as any)?.imageGenerationOptions;

  if (!pricing?.imageGenerationPerImage) {
    return createEmptyCost();
  }

  // Get price based on quality and size
  const qualityPricing = pricing.imageGenerationPerImage[usage.quality];
  let pricePerImage = 0;

  if (typeof qualityPricing === "number") {
    pricePerImage = qualityPricing;
  } else if (qualityPricing && typeof qualityPricing === "object") {
    pricePerImage = qualityPricing[usage.size] || 0;
  }

  const imageCost = pricePerImage * usage.count;

  return {
    inputCost: 0,
    outputCost: 0,
    cacheCost: 0,
    imageCost,
    videoCost: 0,
    totalCost: imageCost,
    currency: "USD",
  };
}

/**
 * Calcula el costo de generación de video
 */
export function calculateVideoCost(
  modelId: string,
  usage: VideoGenerationUsage
): UsageCost {
  const model = modelRegistry.getById(modelId);
  if (!model) {
    return createEmptyCost();
  }

  const pricing = model._providerMetadata?.pricing;

  if (!pricing?.videoGenerationPerSecond) {
    return createEmptyCost();
  }

  let pricePerSecond = 0;

  if (typeof pricing.videoGenerationPerSecond === "number") {
    pricePerSecond = pricing.videoGenerationPerSecond;
  } else if (typeof pricing.videoGenerationPerSecond === "object") {
    pricePerSecond = pricing.videoGenerationPerSecond[usage.resolution] || 0;
  }

  const videoCost = pricePerSecond * usage.durationSeconds;

  return {
    inputCost: 0,
    outputCost: 0,
    cacheCost: 0,
    imageCost: 0,
    videoCost,
    totalCost: videoCost,
    currency: "USD",
  };
}

/**
 * Calcula costo combinado
 */
export function calculateTotalCost(
  modelId: string,
  options: {
    tokens?: TokenUsage;
    images?: ImageGenerationUsage;
    videos?: VideoGenerationUsage;
  }
): UsageCost {
  const costs: UsageCost[] = [];

  if (options.tokens) {
    costs.push(calculateTokenCost(modelId, options.tokens));
  }

  if (options.images) {
    costs.push(calculateImageCost(modelId, options.images));
  }

  if (options.videos) {
    costs.push(calculateVideoCost(modelId, options.videos));
  }

  return combineCosts(costs);
}

// =============================================================================
// ESTIMATION
// =============================================================================

/**
 * Estima el costo de un mensaje basado en longitud de caracteres
 * Usa una aproximación de 4 caracteres = 1 token
 */
export function estimateCostFromText(
  modelId: string,
  inputText: string,
  expectedOutputLength: number = 1000
): UsageCost {
  const estimatedInputTokens = Math.ceil(inputText.length / 4);
  const estimatedOutputTokens = Math.ceil(expectedOutputLength / 4);

  return calculateTokenCost(modelId, {
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
  });
}

/**
 * Compara costos entre modelos para el mismo uso
 */
export function compareModelCosts(
  modelIds: string[],
  usage: TokenUsage
): Array<{ modelId: string; model: RegisteredModel | undefined; cost: UsageCost }> {
  return modelIds.map((modelId) => ({
    modelId,
    model: modelRegistry.getById(modelId),
    cost: calculateTokenCost(modelId, usage),
  })).sort((a, b) => a.cost.totalCost - b.cost.totalCost);
}

// =============================================================================
// HELPERS
// =============================================================================

function createEmptyCost(): UsageCost {
  return {
    inputCost: 0,
    outputCost: 0,
    cacheCost: 0,
    imageCost: 0,
    videoCost: 0,
    totalCost: 0,
    currency: "USD",
  };
}

function combineCosts(costs: UsageCost[]): UsageCost {
  return costs.reduce(
    (acc, cost) => ({
      inputCost: acc.inputCost + cost.inputCost,
      outputCost: acc.outputCost + cost.outputCost,
      cacheCost: acc.cacheCost + cost.cacheCost,
      imageCost: acc.imageCost + cost.imageCost,
      videoCost: acc.videoCost + cost.videoCost,
      totalCost: acc.totalCost + cost.totalCost,
      currency: "USD",
    }),
    createEmptyCost()
  );
}

/**
 * Formatea el costo para mostrar
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

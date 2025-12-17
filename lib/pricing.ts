/**
 * ! Fuentes oficiales de precios:
 * - OpenAI: https://openai.com/pricing
 * - Anthropic: https://www.anthropic.com/pricing
 * - Google AI: https://ai.google.dev/pricing
 * - xAI: https://x.ai/api
 * - DeepSeek: https://platform.deepseek.com/api-docs/pricing
 */

export interface ModelPricing {
  input: number;  // Pricing per 1M tokens of input
  output: number; // Pricing per 1M tokens of output
  cached?: number; // Pricing per 1M tokens of cached (if applies)
}

export interface ProviderPricing {
  [modelId: string]: ModelPricing;
}

/**
 * *Pricing table
 * *All prices are in USD per 1M tokens
 */
export const PRICING: Record<string, ProviderPricing> = {
  // * OPENAI / GPT 
  GPT: {
    //? GPT-5 Series
    "gpt-5.2-2025-12-11": {
      input: 1.75,
      cached: 0.175,
      output: 14.0,
    },
    "gpt-5.2-pro-2025-12-11": {
      input: 21.0,
      output: 168.0,
    },
    "gpt-5.1-2025-11-13": {
      input: 1.25,
      cached: 0.125,
      output: 10.0,
    },
    "gpt-5-mini-2025-08-07": {
      input: 0.25,
      cached: 0.025,
      output: 2.0,
    },
    "gpt-5-nano-2025-08-07": {
      input: 0.05,
      cached: 0.005,
      output: 0.40,
    },
    "gpt-5-pro-2025-10-06": {
      input: 15.0,
      output: 120.0,
    },
    "gpt-5-2025-08-07": {
      input: 1.25,
      cached: 0.125,
      output: 10.0,
    },
    
    //? GPT-4 Series
    "gpt-4.1-2025-04-14": {
      input: 2.0,
      cached: 0.50,
      output: 8.0,
    },
    "gpt-4o": {
      input: 2.50,
      output: 10.0,
      cached: 1.25, 
    },
    "gpt-4o-mini": {
      input: 0.15,
      output: 0.60,
      cached: 0.075,
    },
  },

  // * ANTHROPIC / CLAUDE
  Claude: {
    //? Claude 4.5 Series
    "claude-opus-4-5-20251101": {
      input: 5.0,
      output: 25.0,
      cached: 0.50,
    },
    "claude-sonnet-4-5-20250929": {
      input: 3.0,
      output: 15.0,
      cached: 0.30,
    },
    "claude-haiku-4-5-20251001": {
      input: 1.0,
      output: 5.0,
      cached: 0.10,
    },
    
    //? Claude 4.1 Legacy
    "claude-opus-4-1-20250805": {
      input: 15.0,
      output: 75.0,
      cached: 1.50,
    },
  },

  // * GOOGLE AI / GEMINI
  Gemini: {
    //? Gemini 3 Series
    "gemini-3-pro-preview": {
      input: 4.0,
      output: 18.0,
      cached: 0.40,
    },
    "gemini-3-pro-image-preview": {
      input: 2.0,
      output: 12.0,
    },
    
    //? Gemini 2.5 Series
    "gemini-2.5-flash": {
      input: 0.30,
      output: 2.50,
      cached: 0.0375,
    },
    "gemini-2.5-flash-image": {
      input: 0.30,
      output: 0.039,
    },
    "gemini-2.5-flash-lite": {
      input: 0.20,
      output: 0.40,
      cached: 0.0375,
    },
    "gemini-2.5-pro": {
      input: 2.50,
      output: 15.0,
      cached: 0.25,
    },
    
    //? Gemini 2.0 Flash (Free tier en producción limitada)
    "gemini-2.0-flash": {
      input: 0.0,
      output: 0.0,
    },
  },

  // * XAI / GROK
  Grok: {
    //? Grok 4.1 Series
    "grok-4-1-fast-reasoning": {
      input: 0.20,
      output: 0.50,
      cached: 0.05,
    },
    "grok-4-1-fast-non-reasoning": {
      input: 0.20,
      output: 0.50,
      cached: 0.05,
    },
    
    //? Grok 4 Series
    "grok-4-fast-reasoning": {
      input: 0.20,
      output: 0.50,
      cached: 0.05,
    },
    "grok-4-fast-non-reasoning": {
      input: 0.20,
      output: 0.50,
      cached: 0.05,
    },
  },

  // * DEEPSEEK
  DeepSeek: {
    //? DeepSeek V3 Series
    "deepseek-reasoner": {
      input: 0.28,
      output: 0.42,
      cached: 0.028, 
    },
    "deepseek-chat": {
      input: 0.28,
      output: 0.42,
      cached: 0.028,
    },
  },
};

/**
 * Optain the pricing of a specific model
 */
export function getModelPricing(
  provider: string,
  modelId: string
): ModelPricing | null {
  const providerPricing = PRICING[provider];
  if (!providerPricing) {
    console.warn(`Provider '${provider}' not found in pricing table`);
    return null;
  }

  const modelPricing = providerPricing[modelId];
  if (!modelPricing) {
    console.warn(`Model '${modelId}' not found in pricing table for provider '${provider}'`);
    return null;
  }

  return modelPricing;
}

/**
 * !Calculate the cost of a request
 * 
 * @param provider - Provider (GPT, Claude, Gemini, etc.)
 * @param modelId - Model ID (gpt-4o, claude-3-sonnet, etc.)
 * @param inputTokens - Input tokens
 * @param outputTokens - Output tokens
 * @param cachedTokens - Cached tokens (optional)
 * @returns Total cost in USD
 */
export function calculateCost(
  provider: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number = 0,
  cachedTokens: number = 0
): number {
  const pricing = getModelPricing(provider, modelId);
  
  if (!pricing) {
    console.warn(`Using fallback pricing for ${provider}/${modelId}`);
    const totalTokens = inputTokens + outputTokens + cachedTokens;
    return totalTokens * (1.0 / 1_000_000); // $1 por 1M tokens (estimado)
  }

  const inputCost = (inputTokens * pricing.input) / 1_000_000;
  const outputCost = (outputTokens * pricing.output) / 1_000_000;
  const cachedCost = cachedTokens > 0 && pricing.cached 
    ? (cachedTokens * pricing.cached) / 1_000_000 
    : 0;

  return inputCost + outputCost + cachedCost;
}

/**
 * !Calculate the cost of a request when you only have total tokens
 * !Uses an estimated ratio of 1:3 (input:output) that is common in the industry
 */
export function calculateSimpleCost(
  provider: string,
  modelId: string,
  totalTokens: number
): number {
  
  const estimatedInput = Math.floor(totalTokens * 0.25);
  const estimatedOutput = Math.floor(totalTokens * 0.75);
  
  return calculateCost(provider, modelId, estimatedInput, estimatedOutput);
}

/**
 * !Get pricing information for a specific model
 */
export function getPricingInfo(provider: string, modelId: string): string {
  const pricing = getModelPricing(provider, modelId);
  
  if (!pricing) {
    return "Pricing no disponible";
  }

  const input = `$${pricing.input.toFixed(2)}`;
  const output = `$${pricing.output.toFixed(2)}`;
  
  if (pricing.cached) {
    const cached = `$${pricing.cached.toFixed(2)}`;
    return `${input}/${output} (cached: ${cached}) per 1M tokens`;
  }
  
  return `${input}/${output} per 1M tokens`;
}

/**
 * !Get all pricing information for all models
 */
export function getAllPricing(): Array<{
  provider: string;
  modelId: string;
  pricing: ModelPricing;
  pricePerRequest: string; 
}> {
  const result: Array<{
    provider: string;
    modelId: string;
    pricing: ModelPricing;
    pricePerRequest: string;
  }> = [];

  for (const [provider, models] of Object.entries(PRICING)) {
    for (const [modelId, pricing] of Object.entries(models)) {
      const estimatedCost = calculateCost(provider, modelId, 500, 500);
      
      result.push({
        provider,
        modelId,
        pricing,
        pricePerRequest: `$${estimatedCost.toFixed(4)}`,
      });
    }
  }

  return result;
}

/**
 * !Compare the cost of different models for the same request
 */
export function comparePricing(
  models: Array<{ provider: string; modelId: string }>,
  inputTokens: number,
  outputTokens: number
): Array<{
  provider: string;
  modelId: string;
  cost: number;
  costFormatted: string;
}> {
  return models
    .map(({ provider, modelId }) => ({
      provider,
      modelId,
      cost: calculateCost(provider, modelId, inputTokens, outputTokens),
      costFormatted: `$${calculateCost(provider, modelId, inputTokens, outputTokens).toFixed(4)}`,
    }))
    .sort((a, b) => a.cost - b.cost); 
}

/**
 * !Get the cheapest model of a provider
 */
export function getCheapestModel(provider: string): {
  modelId: string;
  pricing: ModelPricing;
} | null {
  const providerPricing = PRICING[provider];
  if (!providerPricing) return null;

  let cheapestModel: string | null = null;
  let lowestCost = Infinity;

  for (const [modelId, pricing] of Object.entries(providerPricing)) {
    const avgCost = (pricing.input + pricing.output) / 2;
    
    if (avgCost < lowestCost) {
      lowestCost = avgCost;
      cheapestModel = modelId;
    }
  }

  if (!cheapestModel) return null;

  return {
    modelId: cheapestModel,
    pricing: providerPricing[cheapestModel],
  };
}

/**
 * !Calculate the estimated monthly charges based on average usage
 */
export function estimateMonthlyCharges(
  provider: string,
  modelId: string,
  estimatedMessagesPerDay: number,
  avgTokensPerMessage: number = 1000
): {
  daily: number;
  weekly: number;
  monthly: number;
  formatted: {
    daily: string;
    weekly: string;
    monthly: string;
  };
} {
  const costPerMessage = calculateSimpleCost(provider, modelId, avgTokensPerMessage);
  
  const daily = costPerMessage * estimatedMessagesPerDay;
  const weekly = daily * 7;
  const monthly = daily * 30;

  return {
    daily,
    weekly,
    monthly,
    formatted: {
      daily: `$${daily.toFixed(2)}`,
      weekly: `$${weekly.toFixed(2)}`,
      monthly: `$${monthly.toFixed(2)}`,
    },
  };
}
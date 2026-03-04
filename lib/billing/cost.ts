/**
 * Billing cost: model cost + overhead + margin, and conversion to credits.
 * Used for usage records and (in Fase 3) balance deduction.
 */

import { calculateCost } from "@/lib/pricing";

/** Overhead per request in USD (Convex, Redis, etc.) */
const OVERHEAD_PER_REQUEST_USD = Number(process.env.BILLING_OVERHEAD_PER_REQUEST_USD) || 0.0001;

/** Margin factor (e.g. 1.15 = 15% markup) */
const MARGIN_FACTOR = Number(process.env.BILLING_MARGIN_FACTOR) || 1.15;

/** Credits per 1 USD (e.g. 100 means $0.01 = 1 credit) */
export const CREDITS_PER_USD = Number(process.env.BILLING_CREDITS_PER_USD) || 100;

export interface RequestCostResult {
  costUSD: number;
  costCredits: number;
  modelCostUSD: number;
  overheadUSD: number;
  marginFactor: number;
}

/**
 * Compute full request cost: model cost + overhead, then apply margin; convert to credits.
 */
export function computeRequestCost(
  provider: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number = 0
): RequestCostResult {
  const modelCostUSD = calculateCost(provider, modelId, inputTokens, outputTokens, cachedTokens);
  const overheadUSD = OVERHEAD_PER_REQUEST_USD;
  const costUSD = (modelCostUSD + overheadUSD) * MARGIN_FACTOR;
  const costCredits = Math.max(0, Math.ceil(costUSD * CREDITS_PER_USD));
  return {
    costUSD,
    costCredits,
    modelCostUSD,
    overheadUSD,
    marginFactor: MARGIN_FACTOR,
  };
}

/**
 * When only total tokens are known (e.g. from worker), use 1:3 input:output estimate.
 */
export function computeRequestCostFromTotalTokens(
  provider: string,
  modelId: string,
  totalTokens: number
): RequestCostResult {
  const estimatedInput = Math.floor(totalTokens * 0.25);
  const estimatedOutput = Math.floor(totalTokens * 0.75);
  return computeRequestCost(provider, modelId, estimatedInput, estimatedOutput);
}

export interface TokenUsageForCost {
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
}

/**
 * Compute cost from precise token usage when available, otherwise from total with estimate.
 */
export function computeRequestCostFromUsage(
  provider: string,
  modelId: string,
  usage: TokenUsageForCost
): RequestCostResult {
  const hasBreakdown =
    typeof usage.inputTokens === "number" &&
    typeof usage.outputTokens === "number";
  if (hasBreakdown) {
    return computeRequestCost(
      provider,
      modelId,
      usage.inputTokens!,
      usage.outputTokens!,
      usage.cachedTokens ?? 0
    );
  }
  if (typeof usage.totalTokens === "number" && usage.totalTokens >= 0) {
    return computeRequestCostFromTotalTokens(provider, modelId, usage.totalTokens);
  }
  return computeRequestCost(provider, modelId, 0, 0, 0);
}

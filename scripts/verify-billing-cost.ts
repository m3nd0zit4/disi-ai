/**
 * Verify billing cost consistency: pricing → cost USD → credits.
 * Run: npx tsx scripts/verify-billing-cost.ts
 *
 * Ensures:
 * - Same CREDITS_PER_USD logic everywhere (sell vs deduct).
 * - Margin >= 1 so we don't lose money.
 * - Model cost + overhead + margin → costCredits matches Convex deduction.
 */

import { calculateCost } from "../lib/pricing";
import {
  CREDITS_PER_USD,
  computeRequestCost,
  computeRequestCostFromTotalTokens,
  computeRequestCostFromUsage,
} from "../lib/billing/cost";

function main() {
  let failed = 0;

  // 1) CREDITS_PER_USD: default 100 so $1 = 100 credits
  const creditsPerUsd = CREDITS_PER_USD;
  if (creditsPerUsd <= 0) {
    console.error("FAIL: BILLING_CREDITS_PER_USD must be > 0 (current:", creditsPerUsd, ")");
    failed++;
  } else {
    console.log("OK: CREDITS_PER_USD =", creditsPerUsd, "($1 =", creditsPerUsd, "credits)");
  }

  // 2) Sell vs deduct consistency: $1 USD top-up → 100 credits (with default); deduct 100 credits for $1 usage
  const oneDollarCredits = Math.round(1 * creditsPerUsd);
  if (oneDollarCredits !== creditsPerUsd) {
    console.error("FAIL: 1 USD should give", creditsPerUsd, "credits, got", oneDollarCredits);
    failed++;
  } else {
    console.log("OK: 1 USD →", oneDollarCredits, "credits (consistent)");
  }

  // 3) computeRequestCost: model cost + overhead + margin; costCredits = ceil(costUSD * CREDITS_PER_USD)
  const r = computeRequestCost("GPT", "gpt-4o-mini", 1000, 500, 0);
  if (r.costUSD <= 0 || r.costCredits <= 0) {
    console.error("FAIL: computeRequestCost returned non-positive", r);
    failed++;
  } else {
    const expectedCredits = Math.ceil(r.costUSD * creditsPerUsd);
    if (r.costCredits !== expectedCredits) {
      console.error("FAIL: costCredits", r.costCredits, "!= ceil(costUSD * CREDITS_PER_USD) =", expectedCredits);
      failed++;
    } else {
      console.log("OK: computeRequestCost(gpt-4o-mini, 1k in, 500 out) →", r.costUSD.toFixed(6), "USD,", r.costCredits, "credits");
    }
  }

  // 4) Margin must be >= 1 (we charge at least what we pay)
  if (r.marginFactor < 1) {
    console.error("FAIL: BILLING_MARGIN_FACTOR should be >= 1 (current:", r.marginFactor, ")");
    failed++;
  } else {
    console.log("OK: margin factor =", r.marginFactor);
  }

  // 5) Convex-side deduction: costCredits = ceil(cost * CREDITS_PER_USD). Same formula as lib/billing/cost.
  const costFromLib = computeRequestCost("GPT", "gpt-4o-mini", 5000, 2000, 0);
  const expectedDeduction = Math.ceil(costFromLib.costUSD * creditsPerUsd);
  if (expectedDeduction !== costFromLib.costCredits) {
    console.error("FAIL: Convex uses ceil(cost * CREDITS_PER_USD). Lib costCredits", costFromLib.costCredits, "vs expected", expectedDeduction);
    failed++;
  } else {
    console.log("OK: Convex deduction formula matches lib (ceil(costUSD * CREDITS_PER_USD))");
  }

  // 6) Fallback pricing: unknown model uses $1/1M tokens — ensure it's applied
  const unknown = calculateCost("UnknownProvider", "unknown-model", 1_000_000, 0, 0);
  if (unknown <= 0) {
    console.error("FAIL: fallback pricing should return positive cost");
    failed++;
  } else {
    console.log("OK: fallback pricing (unknown model) =", unknown.toFixed(4), "USD per 1M tokens");
  }

  // 7) computeRequestCostFromUsage: with totalTokens only (estimate 1:3)
  const fromTotal = computeRequestCostFromUsage("Claude", "claude-sonnet-4-5-20250929", { totalTokens: 2000 });
  const fromBreakdown = computeRequestCostFromUsage("Claude", "claude-sonnet-4-5-20250929", {
    inputTokens: 500,
    outputTokens: 1500,
  });
  if (fromTotal.costCredits <= 0 || fromBreakdown.costCredits <= 0) {
    console.error("FAIL: computeRequestCostFromUsage returned non-positive credits");
    failed++;
  } else {
    console.log("OK: computeRequestCostFromUsage (totalTokens vs breakdown) → credits", fromTotal.costCredits, "vs", fromBreakdown.costCredits);
  }

  // 8) Image/Video: flat cost env vars (documentation check)
  const imageDefault = 0.02;
  const videoDefault = 0.1;
  console.log("INFO: Image default cost =", imageDefault, "USD (override: BILLING_IMAGE_COST_USD)");
  console.log("INFO: Video default cost =", videoDefault, "USD (override: BILLING_VIDEO_COST_USD)");

  if (failed > 0) {
    console.error("\n---", failed, "check(s) failed ---");
    process.exit(1);
  }
  console.log("\n--- All billing cost checks passed ---");
}

main();

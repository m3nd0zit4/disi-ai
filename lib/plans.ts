/**
 * Plan definitions and feature flags for Starter, Pay As You Go, and Pro.
 * Used for gating Knowledge Garden, credits deduction, and API/queue access.
 */

export type PlanId = "free" | "starter" | "payg" | "pro";

/** Normalize legacy "free" to "starter" for feature checks */
export function normalizePlan(plan: string | undefined): PlanId {
  if (plan === "free") return "starter";
  if (plan === "starter" || plan === "payg" || plan === "pro") return plan;
  return "starter";
}

export interface PlanFeatures {
  knowledgeGarden: boolean;
  canvas: boolean;
  credits: boolean;
  canBuyCredits: boolean;
  /** Monthly credits included (Pro only); undefined for others */
  monthlyCredits?: number;
}

export const PRO_MONTHLY_PRICE_USD = Number(process.env.PRO_MONTHLY_PRICE_USD) || 19;
export const PRO_MONTHLY_CREDITS = Number(process.env.PRO_MONTHLY_CREDITS) || 1500;
export const STARTER_WELCOME_CREDITS = Number(process.env.STARTER_WELCOME_CREDITS) || 100;

const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: {
    knowledgeGarden: false,
    canvas: true,
    credits: false,
    canBuyCredits: true,
  },
  starter: {
    knowledgeGarden: false,
    canvas: true,
    credits: false,
    canBuyCredits: true,
  },
  payg: {
    knowledgeGarden: false,
    canvas: true,
    credits: true,
    canBuyCredits: true,
  },
  pro: {
    knowledgeGarden: true,
    canvas: true,
    credits: true,
    canBuyCredits: true,
    monthlyCredits: PRO_MONTHLY_CREDITS,
  },
};

export function getPlanFeatures(plan: string | undefined): PlanFeatures {
  const p = normalizePlan(plan);
  return PLAN_FEATURES[p];
}

export type PlanFeatureKey = keyof PlanFeatures;

export function hasFeature(plan: string | undefined, feature: PlanFeatureKey): boolean {
  const features = getPlanFeatures(plan);
  const value = features[feature];
  return typeof value === "boolean" ? value : !!value;
}

/** Whether the plan can consume credits (deduct from balance). payg and pro. */
export function canConsumeCredits(plan: string | undefined): boolean {
  return hasFeature(plan, "credits");
}

/** Monthly credits included in subscription (Pro only). */
export function getCreditsAllowance(plan: string | undefined): number | undefined {
  return getPlanFeatures(plan).monthlyCredits;
}

/** Display label for plan (Settings, pricing). */
export function getPlanDisplayName(plan: string | undefined): string {
  switch (plan) {
    case "free":
      return "Free (legacy)";
    case "starter":
      return "Starter";
    case "payg":
      return "Pay As You Go";
    case "pro":
      return "Pro";
    default:
      return "Starter";
  }
}

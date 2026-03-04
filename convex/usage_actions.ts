"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { timingSafeEqual } from "crypto";

const CREDITS_PER_USD = Number(process.env.BILLING_CREDITS_PER_USD) || 100;
const PRO_MONTHLY_CREDITS = Number(process.env.PRO_MONTHLY_CREDITS) || 1500;

function secureCompare(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Record usage (model + tokens + cost). Deducts costCredits from user balance (prepaid).
 * Called by the AI worker after each completion.
 * Requires USAGE_RECORD_SECRET or FILE_WORKER_SECRET.
 */
export const recordUsage = action({
  args: {
    secret: v.string(),
    userId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    modelId: v.string(),
    provider: v.string(),
    category: v.string(),
    providerModelId: v.string(),
    tokens: v.number(),
    cost: v.number(),
  },
  handler: async (ctx, args) => {
    const secretEnv = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
    if (!secureCompare(args.secret, secretEnv)) {
      throw new Error("Unauthorized");
    }
    const costCredits = Math.max(0, Math.ceil(args.cost * CREDITS_PER_USD));
    await ctx.runMutation(internal.usage.internalRecordUsage, {
      userId: args.userId,
      conversationId: args.conversationId,
      modelId: args.modelId,
      provider: args.provider,
      category: args.category,
      providerModelId: args.providerModelId,
      tokens: args.tokens,
      cost: args.cost,
      costCredits,
    });
  },
});

/**
 * Add credits to user balance (e.g. after Stripe top-up). Called from Next.js webhook.
 * Optionally records payment in billingEvents for Latest invoices.
 * Requires USAGE_RECORD_SECRET or FILE_WORKER_SECRET.
 */
export const addCreditsToUser = action({
  args: {
    secret: v.string(),
    stripeCustomerId: v.string(),
    amountCredits: v.number(),
    stripeSessionId: v.optional(v.string()),
    amountUsd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const secretEnv = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
    if (!secureCompare(args.secret, secretEnv)) {
      throw new Error("Unauthorized");
    }
    const user = await ctx.runQuery(api.users.users.getUserByStripeCustomerId, {
      stripeCustomerId: args.stripeCustomerId,
    });
    if (!user) {
      throw new Error("User not found for Stripe customer");
    }
    await ctx.runMutation(internal.usage.internalAddCredits, {
      userId: user._id,
      amountCredits: args.amountCredits,
    });
    if (args.stripeSessionId && args.amountUsd != null) {
      await ctx.runMutation(internal.usage.internalRecordPaymentSucceeded, {
        userId: user._id,
        stripeEventId: args.stripeSessionId,
        amountUsd: args.amountUsd,
        amountCredits: args.amountCredits,
        invoiceType: "Single Purchase",
      });
    }
  },
});

/**
 * Add Pro monthly credits and set plan to pro. Called from Stripe webhook on invoice.paid for Pro subscription.
 * Requires USAGE_RECORD_SECRET or FILE_WORKER_SECRET.
 */
export const addProMonthlyCreditsToUser = action({
  args: {
    secret: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const secretEnv = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
    if (!secureCompare(args.secret, secretEnv)) {
      throw new Error("Unauthorized");
    }
    const user = await ctx.runQuery(api.users.users.getUserByStripeCustomerId, {
      stripeCustomerId: args.stripeCustomerId,
    });
    if (!user) {
      throw new Error("User not found for Stripe customer");
    }
    await ctx.runMutation(internal.usage.internalAddProMonthlyCredits, {
      userId: user._id,
      amountCredits: PRO_MONTHLY_CREDITS,
    });
  },
});

/**
 * Set user's Pro subscription state (plan, subscription fields). Called from Stripe webhook on
 * checkout.session.completed (mode=subscription) and customer.subscription.updated.
 */
export const setProSubscriptionFromStripe = action({
  args: {
    secret: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    subscriptionStatus: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing")
    ),
    subscriptionEndDate: v.number(),
  },
  handler: async (ctx, args) => {
    const secretEnv = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
    if (!secureCompare(args.secret, secretEnv)) {
      throw new Error("Unauthorized");
    }
    const user = await ctx.runQuery(api.users.users.getUserByStripeCustomerId, {
      stripeCustomerId: args.stripeCustomerId,
    });
    if (!user) {
      throw new Error("User not found for Stripe customer");
    }
    await ctx.runMutation(internal.usage.internalSetProSubscription, {
      userId: user._id,
      stripeSubscriptionId: args.stripeSubscriptionId,
      subscriptionStatus: args.subscriptionStatus,
      subscriptionEndDate: args.subscriptionEndDate,
    });
  },
});

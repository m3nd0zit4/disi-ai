import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Internal: insert a usage record and deduct costCredits from user balance (prepaid).
 * Called from recordUsage action after auth.
 */
export const internalRecordUsage = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    modelId: v.string(),
    provider: v.string(),
    category: v.string(),
    providerModelId: v.string(),
    tokens: v.number(),
    cost: v.number(),
    costCredits: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const yearMonth = new Date(now).toISOString().slice(0, 7); // "YYYY-MM"
    await ctx.db.insert("usageRecords", {
      userId: args.userId,
      conversationId: args.conversationId,
      modelId: args.modelId,
      provider: args.provider,
      category: args.category,
      providerModelId: args.providerModelId,
      tokens: args.tokens,
      cost: args.cost,
      timestamp: now,
      yearMonth,
    });

    const user = await ctx.db.get(args.userId);
    // Deduct credits for payg/pro always; for starter/free only when they have balance (welcome credits)
    const canDeduct =
      user &&
      args.costCredits > 0 &&
      (user.plan === "payg" ||
        user.plan === "pro" ||
        ((user.plan === "starter" || user.plan === "free") &&
          (user.balanceCredits ?? 0) > 0));
    if (canDeduct) {
      const current = user!.balanceCredits ?? 0;
      await ctx.db.patch(args.userId, {
        balanceCredits: Math.max(0, current - args.costCredits),
        updatedAt: now,
      });
    }
  },
});

/**
 * Internal: add credits to user balance (e.g. after Stripe top-up). Called from addCreditsToUser action.
 */
export const internalAddCredits = internalMutation({
  args: {
    userId: v.id("users"),
    amountCredits: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.amountCredits <= 0) return;
    const user = await ctx.db.get(args.userId);
    if (!user) return;
    const current = user.balanceCredits ?? 0;
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      balanceCredits: current + args.amountCredits,
      updatedAt: now,
      ...(user.plan === "free" || user.plan === "starter" ? { plan: "payg" as const } : {}),
    });
  },
});

/**
 * Internal: add Pro monthly credits to user and set plan to pro. Called from webhook on Pro subscription invoice.paid.
 */
export const internalAddProMonthlyCredits = internalMutation({
  args: {
    userId: v.id("users"),
    amountCredits: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.amountCredits <= 0) return;
    const user = await ctx.db.get(args.userId);
    if (!user) return;
    const current = user.balanceCredits ?? 0;
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      balanceCredits: current + args.amountCredits,
      plan: "pro" as const,
      updatedAt: now,
    });
  },
});

/**
 * Internal: record a payment_succeeded billing event (for Latest invoices). Called from webhook flow.
 */
export const internalRecordPaymentSucceeded = internalMutation({
  args: {
    userId: v.id("users"),
    stripeEventId: v.string(),
    amountUsd: v.number(),
    amountCredits: v.number(),
    invoiceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("billingEvents", {
      userId: args.userId,
      type: "payment_succeeded",
      stripeEventId: args.stripeEventId,
      amount: args.amountUsd,
      currency: "usd",
      invoiceType: args.invoiceType ?? "Single Purchase",
      amountCredits: args.amountCredits,
      timestamp: Date.now(),
    });
  },
});

/**
 * Internal: set user's Pro subscription state. Called from setProSubscriptionFromStripe action (webhook).
 */
export const internalSetProSubscription = internalMutation({
  args: {
    userId: v.id("users"),
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
    const now = Date.now();
    const isActive = args.subscriptionStatus === "active" || args.subscriptionStatus === "trialing";
    await ctx.db.patch(args.userId, {
      plan: isActive ? ("pro" as const) : ("payg" as const),
      stripeSubscriptionId: args.stripeSubscriptionId,
      subscriptionStatus: args.subscriptionStatus,
      subscriptionEndDate: args.subscriptionEndDate,
      updatedAt: now,
    });
  },
});

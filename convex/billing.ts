import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Latest payment events for the current user (for Billing page "Latest invoices").
 */
export const getLatestInvoices = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];
    const limit = args.limit ?? 10;
    const events = await ctx.db
      .query("billingEvents")
      .withIndex("by_user_and_timestamp", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
    return events
      .filter((e) => e.type === "payment_succeeded")
      .map((e) => ({
        id: e._id,
        stripeEventId: e.stripeEventId,
        date: e.timestamp,
        type: e.invoiceType ?? "Single Purchase",
        amount: e.amount ?? 0,
        amountCredits: e.amountCredits ?? 0,
        status: "Paid" as const,
      }));
  },
});

/**
 * Redeem a promo code for the current user. Adds credits and marks code as used.
 */
export const redeemPromoCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const normalized = args.code.trim().toUpperCase();
    const promo = await ctx.db
      .query("promoCodes")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .first();
    if (!promo) throw new Error("Código no válido");
    if (promo.usedBy != null) throw new Error("Este código ya fue canjeado");

    const now = Date.now();
    await ctx.db.patch(promo._id, { usedBy: user._id, usedAt: now });
    const current = user.balanceCredits ?? 0;
    await ctx.db.patch(user._id, {
      balanceCredits: current + promo.credits,
      updatedAt: now,
      ...(user.plan === "free" || user.plan === "starter" ? { plan: "payg" as const } : {}),
    });
    return { credits: promo.credits };
  },
});

/**
 * Update invoiced billing settings (limit and enabled). xAI-style "Manage invoiced billing".
 */
export const updateInvoicedBilling = mutation({
  args: {
    enabled: v.boolean(),
    limitUsd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");
    const now = Date.now();
    await ctx.db.patch(user._id, {
      invoicedBillingEnabled: args.enabled,
      ...(args.limitUsd != null ? { invoicedBillingLimitUsd: args.limitUsd } : {}),
      updatedAt: now,
    });
  },
});

/**
 * Update billing address. xAI-style "Billing address" modal.
 */
export const updateBillingAddress = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    country: v.string(),
    line1: v.string(),
    line2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    postalCode: v.string(),
    taxIdType: v.optional(v.string()),
    taxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, {
      billingAddress: { ...args },
      updatedAt: Date.now(),
    });
  },
});

import { v } from "convex/values";
import { query } from "./_generated/server";

const MAX_RECORDS = 5000;
const MAX_DAYS_RANGE = 365;

/**
 * Get usage records for the current user in a time range (for Usage dashboard).
 */
export const getUsageInRange = query({
  args: {
    startTs: v.number(),
    endTs: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];
    const rangeDays = (args.endTs - args.startTs) / (24 * 60 * 60 * 1000);
    if (rangeDays > MAX_DAYS_RANGE) return [];
    const records = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_and_timestamp", (q) =>
        q.eq("userId", user._id).gte("timestamp", args.startTs).lte("timestamp", args.endTs)
      )
      .order("desc")
      .take(MAX_RECORDS)
      .then((r) => r.reverse());
    const filtered = records.map((r) => ({
        timestamp: r.timestamp,
        cost: r.cost,
        tokens: r.tokens,
        modelId: r.modelId,
        provider: r.provider,
        category: r.category,
      }));
    return filtered;
  },
});

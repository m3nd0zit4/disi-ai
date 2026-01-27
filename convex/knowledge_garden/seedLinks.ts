import { v } from "convex/values";
import { mutation, query, internalMutation, action } from "../_generated/server";
import { internal } from "../_generated/api";

// Note: The public `create` mutation has been removed for security.
// Use `internalCreate` for internal code or `workerCreateLink` for worker access with secret auth.

export const listBySeed = query({
  args: { seedId: v.id("seeds") },
  handler: async (ctx, args) => {
    // Verify caller identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    // Get user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Verify seed exists and user owns the parent KB
    const seed = await ctx.db.get(args.seedId);
    if (!seed) {
      throw new Error("Seed not found");
    }

    const kb = await ctx.db.get(seed.kbId);
    if (!kb || kb.userId !== user._id) {
      throw new Error("Unauthorized access to seed links");
    }

    // User is authorized, fetch the links
    const linksA = await ctx.db
      .query("seedLinks")
      .withIndex("by_seed_a", (q) => q.eq("seedA", args.seedId))
      .collect();

    const linksB = await ctx.db
      .query("seedLinks")
      .withIndex("by_seed_b", (q) => q.eq("seedB", args.seedId))
      .collect();

    return [...linksA, ...linksB];
  },
});

export const deleteBySeed = internalMutation({
  args: { seedId: v.id("seeds") },
  handler: async (ctx, args) => {
    // Delete all links where this seed is seedA
    const linksA = await ctx.db
      .query("seedLinks")
      .withIndex("by_seed_a", (q) => q.eq("seedA", args.seedId))
      .collect();

    for (const link of linksA) {
      await ctx.db.delete(link._id);
    }

    // Delete all links where this seed is seedB
    const linksB = await ctx.db
      .query("seedLinks")
      .withIndex("by_seed_b", (q) => q.eq("seedB", args.seedId))
      .collect();

    for (const link of linksB) {
      await ctx.db.delete(link._id);
    }

    console.log(`[SeedLinks] Deleted ${linksA.length + linksB.length} links for seed ${args.seedId}`);
  },
});

// Internal mutation for worker to create links
export const internalCreate = internalMutation({
  args: {
    seedA: v.id("seeds"),
    seedB: v.id("seeds"),
    relation: v.union(
      v.literal("RELATED"),
      v.literal("PART_OF"),
      v.literal("CONTRADICTS"),
      v.literal("DERIVED_FROM"),
      v.literal("USED_IN_FLOW")
    ),
    score: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Prevent self-linking
    if (args.seedA === args.seedB) {
      console.log(`[SeedLinks] Prevented self-linking: ${args.seedA}`);
      return null;
    }

    // Check for existing link (prevent duplicates)
    const existingLink = await ctx.db
      .query("seedLinks")
      .withIndex("by_seed_pair", (q) =>
        q.eq("seedA", args.seedA).eq("seedB", args.seedB).eq("relation", args.relation)
      )
      .first();

    if (existingLink) {
      return existingLink._id;
    }

    const linkId = await ctx.db.insert("seedLinks", {
      seedA: args.seedA,
      seedB: args.seedB,
      relation: args.relation,
      score: args.score,
      createdAt: Date.now(),
    });

    return linkId;
  },
});

// Public action for worker to create links (with secret auth)
export const workerCreateLink = action({
  args: {
    secret: v.string(),
    seedA: v.id("seeds"),
    seedB: v.id("seeds"),
    relation: v.union(
      v.literal("RELATED"),
      v.literal("PART_OF"),
      v.literal("CONTRADICTS"),
      v.literal("DERIVED_FROM"),
      v.literal("USED_IN_FLOW")
    ),
    score: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.FILE_WORKER_SECRET) {
      throw new Error("Unauthorized");
    }

    return await ctx.runMutation(internal.knowledge_garden.seedLinks.internalCreate, {
      seedA: args.seedA,
      seedB: args.seedB,
      relation: args.relation,
      score: args.score,
    });
  },
});

import { v } from "convex/values";
import { mutation, query, internalMutation, action } from "../_generated/server";
import { internal } from "../_generated/api";

export const create = mutation({
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
    // Internal mutation, usually called by worker
    // In a real app, we might want to verify the caller is the worker or admin

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
      console.log(`[SeedLinks] Link already exists: ${args.seedA} -> ${args.seedB}`);
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

export const listBySeed = query({
  args: { seedId: v.id("seeds") },
  handler: async (ctx, args) => {
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

export const deleteBySeed = mutation({
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

import { v } from "convex/values";
import { mutation, query, internalMutation, action } from "../_generated/server";
import { api, internal } from "../_generated/api";

export const create = mutation({
  args: {
    kbId: v.id("knowledgeBases"),
    fileId: v.optional(v.id("files")),
    title: v.string(),
    summary: v.optional(v.string()),
    fullText: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.union(v.literal("draft"), v.literal("ready"), v.literal("archived")),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Verify KB ownership
    const kb = await ctx.db.get(args.kbId);
    if (!kb || kb.userId !== user._id) {
      throw new Error("Unauthorized or KB not found");
    }

    // Check for existing seed with same idempotency key (prevent duplicates on retries)
    if (args.idempotencyKey) {
      const existingSeed = await ctx.db
        .query("seeds")
        .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
        .first();

      if (existingSeed) {
        console.log(`[Seeds] Found existing seed with idempotency key: ${args.idempotencyKey}`);
        return existingSeed._id;
      }
    }

    const seedId = await ctx.db.insert("seeds", {
      kbId: args.kbId,
      fileId: args.fileId,
      title: args.title,
      summary: args.summary,
      fullText: args.fullText,
      tags: args.tags,
      status: args.status,
      idempotencyKey: args.idempotencyKey,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    // Update KB stats
    await ctx.db.patch(args.kbId, {
      seedCount: (kb.seedCount || 0) + 1,
      updatedAt: Date.now(),
    });

    return seedId;
  },
});

export const search = query({
  args: {
    query: v.string(),
    kbIds: v.array(v.id("knowledgeBases")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;
    const results = [];

    // Search in each selected KB
    for (const kbId of args.kbIds) {
      const kbResults = await ctx.db
        .query("seeds")
        .withSearchIndex("search_body", (q) => 
          q.search("fullText", args.query).eq("kbId", kbId)
        )
        .take(limit);
      
      results.push(...kbResults);
    }

    return results.slice(0, limit * 2); 
  },
});

export const listByKb = query({
  args: { kbId: v.id("knowledgeBases") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    return await ctx.db
      .query("seeds")
      .withIndex("by_kb", (q) => q.eq("kbId", args.kbId))
      .order("desc")
      .collect();
  },
});

export const listByFile = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("seeds")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .collect();
  },
});

export const listTags = query({
  args: { kbId: v.id("knowledgeBases") },
  handler: async (ctx, args) => {
    const seeds = await ctx.db
      .query("seeds")
      .withIndex("by_kb", (q) => q.eq("kbId", args.kbId))
      .collect();

    const tags = new Set<string>();
    seeds.forEach((seed) => {
      seed.tags?.forEach((tag) => tags.add(tag));
    });

    return Array.from(tags).sort();
  },
});

export const getDetail = query({
  args: { seedId: v.id("seeds") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const seed = await ctx.db.get(args.seedId);
    if (!seed) {
      throw new Error("Seed not found");
    }

    // Verify KB ownership
    const kb = await ctx.db.get(seed.kbId);
    if (!kb || kb.userId !== user._id) {
      throw new Error("Unauthorized or KB not found");
    }

    return seed;
  },
});

export const deleteSeed = internalMutation({
  args: { seedId: v.id("seeds") },
  handler: async (ctx, args) => {
    const seed = await ctx.db.get(args.seedId);
    if (!seed) {
      console.log(`[Seeds] Seed ${args.seedId} not found, skipping delete`);
      return;
    }

    // Delete associated seedLinks first
    await ctx.runMutation(api.knowledge_garden.seedLinks.deleteBySeed, {
      seedId: args.seedId,
    });

    // Update KB stats
    const kb = await ctx.db.get(seed.kbId);
    if (kb) {
      await ctx.db.patch(seed.kbId, {
        seedCount: Math.max(0, (kb.seedCount || 1) - 1),
        updatedAt: Date.now(),
      });
    }

    // Delete the seed
    await ctx.db.delete(args.seedId);

    console.log(`[Seeds] Deleted seed ${args.seedId}`);

    // Return seedId for vector DB cleanup (to be done by caller action)
    return String(args.seedId);
  },
});

// Internal mutation for worker to create seeds (no user auth required)
export const internalCreate = internalMutation({
  args: {
    kbId: v.id("knowledgeBases"),
    fileId: v.optional(v.id("files")),
    title: v.string(),
    summary: v.optional(v.string()),
    fullText: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.union(v.literal("draft"), v.literal("ready"), v.literal("archived")),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get KB to find the owner
    const kb = await ctx.db.get(args.kbId);
    if (!kb) {
      throw new Error("KB not found");
    }

    // Check for existing seed with same idempotency key (prevent duplicates on retries)
    if (args.idempotencyKey) {
      const existingSeed = await ctx.db
        .query("seeds")
        .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
        .first();

      if (existingSeed) {
        console.log(`[Seeds] Found existing seed with idempotency key: ${args.idempotencyKey}`);
        return existingSeed._id;
      }
    }

    const seedId = await ctx.db.insert("seeds", {
      kbId: args.kbId,
      fileId: args.fileId,
      title: args.title,
      summary: args.summary,
      fullText: args.fullText,
      tags: args.tags,
      status: args.status,
      idempotencyKey: args.idempotencyKey,
      createdBy: kb.userId, // Use KB owner as creator
      createdAt: Date.now(),
    });

    // Update KB stats
    await ctx.db.patch(args.kbId, {
      seedCount: (kb.seedCount || 0) + 1,
      updatedAt: Date.now(),
    });

    console.log(`[Seeds] Worker created seed: ${seedId}`);
    return seedId;
  },
});

// Public action for worker to create seeds (with secret auth)
export const workerCreateSeed = action({
  args: {
    secret: v.string(),
    kbId: v.id("knowledgeBases"),
    fileId: v.optional(v.id("files")),
    title: v.string(),
    summary: v.optional(v.string()),
    fullText: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.union(v.literal("draft"), v.literal("ready"), v.literal("archived")),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.FILE_WORKER_SECRET) {
      throw new Error("Unauthorized");
    }

    const seedId = await ctx.runMutation(internal.knowledge_garden.seeds.internalCreate, {
      kbId: args.kbId,
      fileId: args.fileId,
      title: args.title,
      summary: args.summary,
      fullText: args.fullText,
      tags: args.tags,
      status: args.status,
      idempotencyKey: args.idempotencyKey,
    });

    return seedId;
  },
});

// ===== NEW: Status Management & Candidate Conversion =====

/**
 * Update seed status
 */
export const updateStatus = mutation({
  args: {
    seedId: v.id("seeds"),
    status: v.union(
      v.literal("draft"),
      v.literal("ready"),
      v.literal("archived")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const seed = await ctx.db.get(args.seedId);
    if (!seed) throw new Error("Seed not found");

    // Verify KB ownership
    const kb = await ctx.db.get(seed.kbId);
    if (!kb || kb.userId !== user._id) throw new Error("Unauthorized");

    await ctx.db.patch(args.seedId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    console.log(`[Seeds] Updated seed ${args.seedId} status to ${args.status}`);
    return { success: true };
  },
});

/**
 * Create seed from candidate (converts candidate to full seed)
 */
export const createFromCandidate = mutation({
  args: {
    candidateId: v.id("seedCandidates"),
    kbId: v.id("knowledgeBases"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("ready")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Verify KB ownership
    const kb = await ctx.db.get(args.kbId);
    if (!kb || kb.userId !== user._id) throw new Error("Unauthorized KB");

    // Get candidate
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) throw new Error("Candidate not found");
    if (candidate.userId !== user._id) throw new Error("Unauthorized candidate");
    if (candidate.status === "converted") throw new Error("Candidate already converted");

    // Create idempotency key from candidate ID
    const idempotencyKey = `candidate-${args.candidateId}`;

    // Check for existing seed
    const existingSeed = await ctx.db
      .query("seeds")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
      .first();

    if (existingSeed) {
      console.log(`[Seeds] Seed already exists for candidate: ${args.candidateId}`);
      return existingSeed._id;
    }

    // Create the seed
    const seedId = await ctx.db.insert("seeds", {
      kbId: args.kbId,
      sourceFlowId: candidate.canvasId,
      title: args.title || candidate.title,
      summary: args.summary || candidate.summary,
      fullText: candidate.content,
      tags: args.tags || [],
      status: args.status || "ready",
      idempotencyKey,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    // Update candidate status
    await ctx.db.patch(args.candidateId, {
      status: "converted",
      reviewedAt: Date.now(),
      convertedSeedId: seedId,
    });

    // Update KB stats
    await ctx.db.patch(args.kbId, {
      seedCount: (kb.seedCount || 0) + 1,
      updatedAt: Date.now(),
    });

    console.log(`[Seeds] Created seed ${seedId} from candidate ${args.candidateId}`);
    return seedId;
  },
});

/**
 * Update seed content and metadata
 */
export const update = mutation({
  args: {
    seedId: v.id("seeds"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    fullText: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const seed = await ctx.db.get(args.seedId);
    if (!seed) throw new Error("Seed not found");

    // Verify KB ownership
    const kb = await ctx.db.get(seed.kbId);
    if (!kb || kb.userId !== user._id) throw new Error("Unauthorized");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.summary !== undefined) updates.summary = args.summary;
    if (args.fullText !== undefined) updates.fullText = args.fullText;
    if (args.tags !== undefined) updates.tags = args.tags;

    await ctx.db.patch(args.seedId, updates);

    console.log(`[Seeds] Updated seed ${args.seedId}`);
    return { success: true };
  },
});

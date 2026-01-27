import { v } from "convex/values";
import { mutation, query, internalMutation, action } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// ===== QUERIES =====

/**
 * List pending candidates for current user (for assisted mode suggestions)
 */
export const listPending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    return await ctx.db
      .query("seedCandidates")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending")
      )
      .order("desc")
      .take(args.limit || 20);
  },
});

/**
 * Get candidates for a specific canvas
 */
export const getByCanvas = query({
  args: { canvasId: v.id("canvas") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    const candidates = await ctx.db
      .query("seedCandidates")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    // Filter by user ownership
    return candidates.filter((c) => c.userId === user._id);
  },
});

/**
 * Get recent auto-approved candidates (for UI feedback)
 */
export const getRecentAutoApproved = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    return await ctx.db
      .query("seedCandidates")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "auto_approved")
      )
      .order("desc")
      .take(args.limit || 10);
  },
});

/**
 * Get a single candidate by ID
 */
export const get = query({
  args: { candidateId: v.id("seedCandidates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return null;

    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate || candidate.userId !== user._id) return null;

    return candidate;
  },
});

/**
 * Count pending candidates for badge UI
 */
export const countPending = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return 0;

    const pending = await ctx.db
      .query("seedCandidates")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending")
      )
      .collect();

    return pending.length;
  },
});

// ===== MUTATIONS =====

/**
 * Create a new candidate (authenticated)
 */
export const createCandidate = mutation({
  args: {
    kbId: v.optional(v.id("knowledgeBases")),
    canvasId: v.optional(v.id("canvas")),
    nodeId: v.optional(v.string()),
    executionId: v.optional(v.id("canvasExecutions")),
    modelResponseId: v.optional(v.id("modelResponses")),
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
    evaluationScore: v.number(),
    evaluationReasons: v.array(v.string()),
    evaluationMetrics: v.optional(
      v.object({
        wordCount: v.number(),
        sentenceCount: v.number(),
        hasStructure: v.boolean(),
        hasCodeBlocks: v.boolean(),
        informationDensity: v.number(),
      })
    ),
    similarSeedId: v.optional(v.id("seeds")),
    similarityScore: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("auto_approved")),
    feedMode: v.union(
      v.literal("manual"),
      v.literal("assisted"),
      v.literal("automatic")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // If kbId provided, verify ownership
    if (args.kbId) {
      const kb = await ctx.db.get(args.kbId);
      if (!kb || kb.userId !== user._id) {
        throw new Error("Invalid Knowledge Base");
      }
    }

    const candidateId = await ctx.db.insert("seedCandidates", {
      userId: user._id,
      kbId: args.kbId,
      canvasId: args.canvasId,
      nodeId: args.nodeId,
      executionId: args.executionId,
      modelResponseId: args.modelResponseId,
      title: args.title,
      content: args.content,
      summary: args.summary,
      evaluationScore: args.evaluationScore,
      evaluationReasons: args.evaluationReasons,
      evaluationMetrics: args.evaluationMetrics,
      similarSeedId: args.similarSeedId,
      similarityScore: args.similarityScore,
      status: args.status,
      feedMode: args.feedMode,
      createdAt: Date.now(),
    });

    console.log(`[SeedCandidates] Created candidate: ${candidateId}, mode: ${args.feedMode}`);
    return candidateId;
  },
});

/**
 * Accept a candidate and convert to seed
 */
export const acceptCandidate = mutation({
  args: {
    candidateId: v.id("seedCandidates"),
    kbId: v.id("knowledgeBases"),
    title: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Get candidate
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) throw new Error("Candidate not found");
    if (candidate.userId !== user._id) throw new Error("Unauthorized");
    if (candidate.status === "converted") throw new Error("Already converted");

    // Verify KB ownership
    const kb = await ctx.db.get(args.kbId);
    if (!kb || kb.userId !== user._id) throw new Error("Invalid Knowledge Base");

    // Create idempotency key from candidate ID
    const idempotencyKey = `candidate-${args.candidateId}`;

    // Create the seed
    const seedId = await ctx.db.insert("seeds", {
      kbId: args.kbId,
      sourceFlowId: candidate.canvasId, // Track canvas origin
      title: args.title || candidate.title,
      summary: candidate.summary,
      fullText: candidate.content,
      tags: args.tags || [],
      status: "ready",
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

    console.log(`[SeedCandidates] Accepted candidate ${args.candidateId}, created seed ${seedId}`);
    return seedId;
  },
});

/**
 * Reject a candidate
 */
export const rejectCandidate = mutation({
  args: {
    candidateId: v.id("seedCandidates"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) throw new Error("Candidate not found");
    if (candidate.userId !== user._id) throw new Error("Unauthorized");

    await ctx.db.patch(args.candidateId, {
      status: "rejected",
      reviewedAt: Date.now(),
    });

    console.log(`[SeedCandidates] Rejected candidate ${args.candidateId}`);
    return { success: true };
  },
});

/**
 * Delete old candidates (cleanup)
 */
export const deleteOldCandidates = mutation({
  args: {
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const daysAgo = args.olderThanDays || 30;
    const cutoffTime = Date.now() - daysAgo * 24 * 60 * 60 * 1000;

    const oldCandidates = await ctx.db
      .query("seedCandidates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.lt(q.field("createdAt"), cutoffTime),
          q.or(
            q.eq(q.field("status"), "rejected"),
            q.eq(q.field("status"), "converted")
          )
        )
      )
      .collect();

    for (const candidate of oldCandidates) {
      await ctx.db.delete(candidate._id);
    }

    console.log(`[SeedCandidates] Deleted ${oldCandidates.length} old candidates`);
    return { deleted: oldCandidates.length };
  },
});

// ===== INTERNAL MUTATIONS =====

/**
 * Internal mutation for worker to create candidates (no user auth required)
 */
export const internalCreateCandidate = internalMutation({
  args: {
    userId: v.id("users"),
    kbId: v.optional(v.id("knowledgeBases")),
    canvasId: v.optional(v.id("canvas")),
    nodeId: v.optional(v.string()),
    executionId: v.optional(v.id("canvasExecutions")),
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
    evaluationScore: v.number(),
    evaluationReasons: v.array(v.string()),
    evaluationMetrics: v.optional(v.any()),
    similarSeedId: v.optional(v.id("seeds")),
    similarityScore: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("auto_approved")),
    feedMode: v.union(
      v.literal("manual"),
      v.literal("assisted"),
      v.literal("automatic")
    ),
  },
  handler: async (ctx, args) => {
    const candidateId = await ctx.db.insert("seedCandidates", {
      ...args,
      createdAt: Date.now(),
    });

    console.log(`[SeedCandidates] Worker created candidate: ${candidateId}`);
    return candidateId;
  },
});

// ===== ACTIONS (for worker with secret auth) =====

/**
 * Public action for worker to create candidates (with secret auth)
 */
export const workerCreateCandidate = action({
  args: {
    secret: v.string(),
    userId: v.id("users"),
    kbId: v.optional(v.id("knowledgeBases")),
    canvasId: v.optional(v.id("canvas")),
    nodeId: v.optional(v.string()),
    executionId: v.optional(v.id("canvasExecutions")),
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
    evaluationScore: v.number(),
    evaluationReasons: v.array(v.string()),
    evaluationMetrics: v.optional(v.any()),
    similarSeedId: v.optional(v.id("seeds")),
    similarityScore: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("auto_approved")),
    feedMode: v.union(
      v.literal("manual"),
      v.literal("assisted"),
      v.literal("automatic")
    ),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.FILE_WORKER_SECRET) {
      throw new Error("Unauthorized");
    }

    const { secret, ...data } = args;

    const candidateId = await ctx.runMutation(
      internal.knowledge_garden.seedCandidates.internalCreateCandidate,
      data
    );

    return candidateId;
  },
});

/**
 * Public action for worker to auto-create seed directly (automatic mode)
 */
export const workerAutoCreateSeed = action({
  args: {
    secret: v.string(),
    userId: v.id("users"),
    kbId: v.id("knowledgeBases"),
    canvasId: v.optional(v.id("canvas")),
    nodeId: v.optional(v.string()),
    executionId: v.optional(v.id("canvasExecutions")),
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.FILE_WORKER_SECRET) {
      throw new Error("Unauthorized");
    }

    // Create seed directly using internal mutation
    const seedId = await ctx.runMutation(
      internal.knowledge_garden.seeds.internalCreate,
      {
        kbId: args.kbId,
        title: args.title,
        summary: args.summary,
        fullText: args.content,
        tags: args.tags || ["ai-generated", "auto-feed"],
        status: "ready",
        idempotencyKey: args.idempotencyKey,
      }
    );

    console.log(`[SeedCandidates] Worker auto-created seed: ${seedId}`);
    return seedId;
  },
});

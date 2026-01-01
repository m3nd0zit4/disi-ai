import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// CREATE EXECUTION
export const createCanvasExecution = mutation({
  args: {
    canvasId: v.id("canvas"),
    input: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const executionId = await ctx.db.insert("canvasExecutions", {
      canvasId: args.canvasId,
      userId: user._id,
      input: args.input,
      status: "pending",
      nodeExecutions: [],
      createdAt: Date.now(),
    });

    return executionId;
  },
});

export const createCanvasExecutionByClerkId = mutation({
  args: {
    canvasId: v.id("canvas"),
    clerkId: v.string(),
    input: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const executionId = await ctx.db.insert("canvasExecutions", {
      canvasId: args.canvasId,
      userId: user._id,
      input: args.input,
      status: "pending",
      nodeExecutions: [],
      createdAt: Date.now(),
    });

    return executionId;
  },
});

// UPDATE EXECUTION STATUS
export const updateExecutionStatus = mutation({
  args: {
    executionId: v.id("canvasExecutions"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    totalTokens: v.optional(v.number()),
    totalCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { executionId, ...updates } = args;
    
    const patch: Record<string, any> = { ...updates };
    if (args.status === "completed" || args.status === "failed") {
      patch.completedAt = Date.now();
      
      // Update canvas stats
      const execution = await ctx.db.get(executionId);
      if (execution) {
        const canvas = await ctx.db.get(execution.canvasId);
        if (canvas) {
          await ctx.db.patch(execution.canvasId, {
            executionCount: (canvas.executionCount || 0) + 1,
            lastExecutedAt: Date.now(),
          });
        }
      }
    }

    await ctx.db.patch(executionId, patch);
  },
});

// UPDATE NODE EXECUTION
export const updateNodeExecution = mutation({
  args: {
    executionId: v.id("canvasExecutions"),
    nodeId: v.string(),
    status: v.string(),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (!execution) throw new Error("Execution not found");

    const nodeExecutions = [...execution.nodeExecutions];
    const nodeIndex = nodeExecutions.findIndex((n) => n.nodeId === args.nodeId);

    const nodeUpdate = {
      nodeId: args.nodeId,
      status: args.status,
      input: args.input,
      output: args.output,
      error: args.error,
      duration: args.duration,
    };

    if (nodeIndex > -1) {
      nodeExecutions[nodeIndex] = nodeUpdate;
    } else {
      nodeExecutions.push(nodeUpdate);
    }

    await ctx.db.patch(args.executionId, { nodeExecutions });
  },
});

// GET EXECUTION
export const getExecution = query({
  args: { executionId: v.id("canvasExecutions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.executionId);
  },
});

// LIST EXECUTIONS FOR CANVAS
export const listCanvasExecutions = query({
  args: { canvasId: v.id("canvas") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("canvasExecutions")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .order("desc")
      .collect();
  },
});

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

    // Verify canvas exists and is owned by the user
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");
    if (canvas.userId !== user._id) throw new Error("Not authorized");

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

/**
 * Internal mutation for updating execution status from the AI worker.
 * NOTE: This mutation is intended for server-to-server use only (e.g., AI worker).
 * It does not verify user authentication as it is called from trusted backend services.
 */
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

      // 1. Sync to Canvas Node
      // We use the same logic pattern as updateNodeDataInternal to ensure consistency
      const canvas = await ctx.db.get(execution.canvasId);
      if (canvas) {
        const updatedNodes = canvas.nodes.map((node: any) => {
          if (node.id === args.nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                status: args.status,
                output: args.output,
                error: args.error,
                lastExecutedAt: Date.now(),
              },
            };
          }
          return node;
        });

        await ctx.db.patch(execution.canvasId, {
          nodes: updatedNodes,
          updatedAt: Date.now(),
        });

      // 2. Sync to Chat Tables (Conversations, Messages, ModelResponses)
      // Only proceed if the execution is completed successfully and has output
      if (args.status === "completed" && args.output) {
        // Find or create conversation for this canvas
        let conversation = await ctx.db
          .query("conversations")
          .withIndex("by_canvas", (q) => q.eq("canvasId", execution.canvasId))
          .first();

        if (!conversation) {
          // Create new conversation
          const conversationId = await ctx.db.insert("conversations", {
            userId: execution.userId,
            title: canvas.name,
            canvasId: execution.canvasId,
            models: [], // We'll update this if needed
            messageCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastMessageAt: Date.now(),
          });
          conversation = await ctx.db.get(conversationId);
        }

        if (conversation) {
          // Extract prompt from input
          // Input structure depends on the node type and context collection
          // Usually args.input has { prompt: "...", context: [...] } or similar
          let promptContent = "User Input";
          if (typeof args.input === "string") {
            promptContent = args.input;
          } else if (args.input?.prompt) {
            promptContent = args.input.prompt;
          } else if (args.input?.text) {
            promptContent = args.input.text;
          } else if (args.input?.context && Array.isArray(args.input.context)) {
             // Try to find the last user message in context or just use a generic label
             // For now, let's serialize the input if it's complex, or just say "Node Execution Input"
             promptContent = JSON.stringify(args.input);
          }

          // Create Message (User)
          const messageId = await ctx.db.insert("messages", {
            conversationId: conversation._id,
            userId: execution.userId,
            role: "user",
            content: promptContent,
            createdAt: Date.now(),
          });

          // Determine model info from node data or input
          // We need to look at the node in the canvas to get model config
          const node = canvas.nodes.find((n: any) => n.id === args.nodeId);
          const modelId = node?.data?.modelId || "unknown";
          const provider = node?.data?.provider || "unknown"; // You might need to fetch this from config or node data

          // Create Model Response (Assistant)
          let responseContent = "";
          if (typeof args.output === "string") {
            responseContent = args.output;
          } else if (args.output?.text) {
            responseContent = args.output.text;
          } else {
            responseContent = JSON.stringify(args.output);
          }

          await ctx.db.insert("modelResponses", {
            messageId: messageId,
            conversationId: conversation._id,
            userId: execution.userId,
            modelId: modelId,
            provider: provider,
            category: "text", // Defaulting to text
            providerModelId: modelId,
            content: responseContent,
            status: "completed",
            createdAt: Date.now(),
            completedAt: Date.now(),
            tokens: args.output?.usage?.totalTokens,
            cost: args.output?.usage?.cost,
          });

          // Update conversation stats
          await ctx.db.patch(conversation._id, {
            messageCount: (conversation.messageCount || 0) + 2,
            lastMessageAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    }
  },
});

// GET EXECUTION
export const getExecution = query({
  args: { executionId: v.id("canvasExecutions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const execution = await ctx.db.get(args.executionId);
    if (!execution) return null;

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || execution.userId !== user._id) {
      return null;
    }

    return execution;
  },
});

// LIST EXECUTIONS FOR CANVAS
export const listCanvasExecutions = query({
  args: { canvasId: v.id("canvas") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Verify user owns the canvas
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || canvas.userId !== user._id) {
      return [];
    }

    return await ctx.db
      .query("canvasExecutions")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .order("desc")
      .collect();
  },
});

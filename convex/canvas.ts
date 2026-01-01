import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// CREATE
export const createCanvas = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    nodes: v.optional(v.array(v.any())),
    edges: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const canvasId = await ctx.db.insert("canvas", {
      userId: user._id,
      name: args.name,
      description: args.description,
      nodes: args.nodes || [],
      edges: args.edges || [],
      createdAt: Date.now(),
    });

    return canvasId;
  },
});

// READ
export const getCanvas = query({
  args: { canvasId: v.id("canvas") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) return null;

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || canvas.userId !== user._id) {
      return null;
    }

    return canvas;
  },
});

export const getCanvasByClerkId = query({
  args: { canvasId: v.id("canvas"), clerkId: v.string() },
  handler: async (ctx, args) => {
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || canvas.userId !== user._id) {
      return null;
    }

    return canvas;
  },
});

// UPDATE
export const updateCanvas = mutation({
  args: {
    canvasId: v.id("canvas"),
    name: v.optional(v.string()),
    nodes: v.optional(v.array(v.any())),
    edges: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const { canvasId, ...updates } = args;
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Not authenticated" };

    const canvas = await ctx.db.get(canvasId);
    if (!canvas) throw new Error("Canvas not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || canvas.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(canvasId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ADD NODE
export const addNode = mutation({
  args: {
    canvasId: v.id("canvas"),
    node: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || canvas.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    const newNodes = [...canvas.nodes, args.node];

    await ctx.db.patch(args.canvasId, {
      nodes: newNodes,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const updateNodeDataInternal = mutation({
  args: {
    canvasId: v.id("canvas"),
    nodeId: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");

    const newNodes = canvas.nodes.map((node: Record<string, any>) => {
      if (node.id === args.nodeId) {
        return { ...node, data: { ...node.data, ...args.data } };
      }
      return node;
    });

    await ctx.db.patch(args.canvasId, {
      nodes: newNodes,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ADD NODES AND EDGES
export const addNodesAndEdges = mutation({
  args: {
    canvasId: v.id("canvas"),
    nodes: v.array(v.any()),
    edges: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || canvas.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    const newNodes = [...canvas.nodes, ...args.nodes];
    const newEdges = [...canvas.edges, ...args.edges];

    await ctx.db.patch(args.canvasId, {
      nodes: newNodes,
      edges: newEdges,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const addNodesAndEdgesByClerkId = mutation({
  args: {
    canvasId: v.id("canvas"),
    clerkId: v.string(),
    nodes: v.array(v.any()),
    edges: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");

    if (canvas.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    const existingNodeIds = new Set(canvas.nodes.map((n: Record<string, any>) => n.id));
    const existingEdgeIds = new Set(canvas.edges.map((e: Record<string, any>) => e.id));

    const uniqueNewNodes = args.nodes.filter((n: Record<string, any>) => !existingNodeIds.has(n.id));
    const uniqueNewEdges = args.edges.filter((e: Record<string, any>) => !existingEdgeIds.has(e.id));

    const newNodes = [...canvas.nodes, ...uniqueNewNodes];
    const newEdges = [...canvas.edges, ...uniqueNewEdges];

    await ctx.db.patch(args.canvasId, {
      nodes: newNodes,
      edges: newEdges,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// DELETE
export const deleteCanvas = mutation({
  args: { canvasId: v.id("canvas") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || canvas.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.canvasId);
    return { success: true };
  },
});

// LIST
export const listCanvas = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    const canvasList = await ctx.db
      .query("canvas")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return canvasList;
  },
});

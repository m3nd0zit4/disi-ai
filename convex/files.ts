import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// 1. Create File Record (Internal Mutation)
export const internalCreateFile = internalMutation({
  args: {
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    canvasId: v.id("canvas"),
    userId: v.string(),
    s3Key: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user exists (optional, but good practice)
    // const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", args.userId)).first();
    // For now, we trust the userId passed from the action (which gets it from auth)
    
    // Find the user ID based on the clerk ID (subject)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const fileId = await ctx.db.insert("files", {
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      canvasId: args.canvasId,
      userId: user._id,
      s3Key: args.s3Key,
      status: "uploading",
      createdAt: Date.now(),
    });

    return fileId;
  },
});

// 2. Create Record (Public Action)
export const createFile = action({
  args: {
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    canvasId: v.id("canvas"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    // Generate unique S3 key
    const uniqueId = crypto.randomUUID();
    const s3Key = `${identity.subject}/${uniqueId}-${args.fileName}`;

    // Create record in Convex FIRST
    const fileId = await ctx.runMutation(internal.files.internalCreateFile, {
      ...args,
      userId: identity.subject, // Clerk ID
      s3Key,
    });

    return { fileId, s3Key };
  },
});

// 3. Update Status (Internal Mutation - called by Lambda/Worker)
export const updateStatus = internalMutation({
  args: {
    fileId: v.id("files"),
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
    extractedTextLength: v.optional(v.number()),
    totalChunks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { fileId, ...updates } = args;
    
    await ctx.db.patch(fileId, {
      ...updates,
      processedAt: args.status === "ready" ? Date.now() : undefined,
    });
  },
});

// 4. Get Files for Canvas (Query)
export const getFiles = query({
  args: { canvasId: v.id("canvas") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .order("desc")
      .collect();
  },
});

// 5. Get File by ID (Query)
export const getFile = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.fileId);
  },
});

// 6. Get File by S3 Key (Internal Query)
export const getFileByS3Key = query({
  args: { s3Key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_s3_key", (q) => q.eq("s3Key", args.s3Key))
      .first();
  },
});

// 7. Update Status by S3 Key (Internal Mutation - called by Lambda)
export const updateStatusByS3Key = internalMutation({
  args: {
    s3Key: v.string(),
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
    extractedTextLength: v.optional(v.number()),
    totalChunks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query("files")
      .withIndex("by_s3_key", (q) => q.eq("s3Key", args.s3Key))
      .first();

    if (!file) {
      throw new Error(`File with s3Key ${args.s3Key} not found`);
    }

    const { status, ...updates } = args;
    
    await ctx.db.patch(file._id, {
      status,
      ...updates,
      processedAt: args.status === "ready" ? Date.now() : undefined,
    });
  },
});

// 8. Get Pending Files (Query - called by Local Worker)
export const getPendingFiles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("files")
      .withIndex("by_status", (q) => q.eq("status", "uploading"))
      .collect();
  },
});

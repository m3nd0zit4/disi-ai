import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { action, internalMutation, query, internalQuery, mutation } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// 1. Create File Record (Internal Mutation)
export const internalCreateFile = internalMutation({
  args: {
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    canvasId: v.optional(v.id("canvas")),
    kbId: v.optional(v.id("knowledgeBases")),
    userId: v.string(),
    s3Key: v.string(),
  },
  handler: async (ctx, args) => {
    // args.userId is now a Convex User ID (v.id("users"))
    const user = await ctx.db.get(args.userId as Id<"users">);

    if (!user) {
      throw new Error("User not found");
    }

    const fileId = await ctx.db.insert("files", {
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      canvasId: args.canvasId,
      kbId: args.kbId,
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
    kbId: v.optional(v.id("knowledgeBases")),
    canvasId: v.optional(v.id("canvas")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    // Get Convex user from Clerk ID
    const user = await ctx.runQuery(api.users.users.getUserByClerkId, { clerkId: identity.subject });
    if (!user) {
      throw new Error("User not found");
    }

    // Verify ownership if KB or Canvas is provided
    if (args.kbId) {
      const kb = await ctx.runQuery(api.knowledge_garden.knowledgeBases.get, { id: args.kbId });
      if (!kb || kb.userId !== user._id) {
        throw new Error("Unauthorized: You do not own this Knowledge Base");
      }
    }

    if (args.canvasId) {
      const canvas = await ctx.runQuery(internal.canvas.canvas.getCanvas, { canvasId: args.canvasId });
      if (!canvas || canvas.userId !== user._id) {
        throw new Error("Unauthorized: You do not own this Canvas");
      }
    }

    // Generate unique S3 key
    const uniqueId = crypto.randomUUID();
    const s3Key = `${identity.subject}/${uniqueId}-${args.fileName}`;

    // Create record in Convex FIRST
    const fileId = await ctx.runMutation(internal.system.files.internalCreateFile, {
      ...args,
      userId: user._id, // Convex User ID
      s3Key,
    });

    return { fileId, s3Key };
  },
});

export const generateUploadUrl = action({
  args: {
    kbId: v.optional(v.id("knowledgeBases")),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    console.log(`[Files] generateUploadUrl called for ${args.fileName} (KB: ${args.kbId})`);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.runQuery(api.users.users.getUserByClerkId, { clerkId: identity.subject });
    if (!user) {
      throw new Error("User not found");
    }

    // Verify KB ownership
    if (args.kbId) {
      const kb = await ctx.runQuery(api.knowledge_garden.knowledgeBases.get, { id: args.kbId });
      if (!kb || kb.userId !== user._id) {
        throw new Error("Unauthorized");
      }
    }

    const uniqueId = crypto.randomUUID();
    const s3Key = `${identity.subject}/${uniqueId}-${args.fileName}`;

    // Create file record
    const fileId = await ctx.runMutation(internal.system.files.internalCreateFile, {
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      userId: user._id,
      s3Key,
      kbId: args.kbId, 
    } as any); 

    console.log(`[Files] File record created: ${fileId}`);

    // Generate Presigned URL
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || "us-east-1";

    console.log(`[Files] AWS Config - Region: ${region}, Bucket: ${bucketName || "NOT SET!"}`);

    if (!accessKeyId || !secretAccessKey) {
      console.error("[Files] AWS credentials missing!");
      throw new Error("AWS credentials are not configured in Convex environment variables.");
    }

    if (!bucketName) {
      console.error("[Files] AWS_S3_BUCKET_NAME is not configured in Convex!");
      throw new Error("AWS_S3_BUCKET_NAME is not configured in Convex environment variables.");
    }

    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: args.fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    console.log(`[Files] Upload URL generated: ${uploadUrl.substring(0, 80)}...`);
    
    return { fileId, s3Key, uploadUrl };
  },
});

// 3. Confirm Upload - Internal Mutation (changes status from uploading to uploaded)
export const internalConfirmUpload = internalMutation({
  args: {
    fileId: v.id("files"),
    userId: v.string(), // Clerk ID for verification
  },
  handler: async (ctx, args) => {
    console.log(`[Files] internalConfirmUpload called - fileId: ${args.fileId}, clerkId: ${args.userId}`);

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      console.error(`[Files] internalConfirmUpload - File not found: ${args.fileId}`);
      throw new Error("File not found");
    }
    console.log(`[Files] internalConfirmUpload - File found, current status: ${file.status}, kbId: ${file.kbId}`);

    // Verify ownership via Clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user || file.userId !== user._id) {
      console.error(`[Files] internalConfirmUpload - Unauthorized. User found: ${!!user}, file.userId: ${file.userId}, user._id: ${user?._id}`);
      throw new Error("Unauthorized");
    }

    // Update status to 'uploaded' so worker can pick it up
    await ctx.db.patch(args.fileId, {
      status: "uploaded",
    });

    console.log(`[Files] File ${args.fileId} status changed to 'uploaded' - READY FOR WORKER`);
  },
});

export const confirmUpload = action({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    console.log(`[Files] confirmUpload called for fileId: ${args.fileId}`);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error("[Files] confirmUpload failed: User not authenticated");
      throw new Error("Unauthenticated");
    }
    console.log(`[Files] confirmUpload - user authenticated: ${identity.subject}`);

    try {
      await ctx.runMutation(internal.system.files.internalConfirmUpload, {
        fileId: args.fileId,
        userId: identity.subject,
      });
      console.log(`[Files] confirmUpload completed successfully for fileId: ${args.fileId}`);
    } catch (error) {
      console.error(`[Files] confirmUpload mutation failed for fileId: ${args.fileId}`, error);
      throw error;
    }
  },
});

// Internal mutation to update file status by S3 key (used by worker)
export const internalUpdateStatusByS3Key = internalMutation({
  args: {
    s3Key: v.string(),
    status: v.string(),
    extractedTextLength: v.optional(v.number()),
    totalChunks: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query("files")
      .withIndex("by_s3_key", (q) => q.eq("s3Key", args.s3Key))
      .unique();

    if (!file) {
      throw new Error(`File not found for s3Key: ${args.s3Key}`);
    }

    const updateData: Record<string, unknown> = {
      status: args.status,
    };

    if (args.extractedTextLength !== undefined) {
      updateData.extractedTextLength = args.extractedTextLength;
    }
    if (args.totalChunks !== undefined) {
      updateData.totalChunks = args.totalChunks;
    }
    if (args.errorMessage !== undefined) {
      updateData.errorMessage = args.errorMessage;
    }

    await ctx.db.patch(file._id, updateData);
    console.log(`[Files] File ${file._id} status updated to '${args.status}'`);
  },
});

// Public action for worker to update file status (with secret authentication)
export const publicUpdateStatusByS3Key = action({
  args: {
    secret: v.string(),
    s3Key: v.string(),
    status: v.string(),
    extractedTextLength: v.optional(v.number()),
    totalChunks: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.FILE_WORKER_SECRET) {
      throw new Error("Unauthorized");
    }

    await ctx.runMutation(internal.system.files.internalUpdateStatusByS3Key, {
      s3Key: args.s3Key,
      status: args.status,
      extractedTextLength: args.extractedTextLength,
      totalChunks: args.totalChunks,
      errorMessage: args.errorMessage,
    });
  },
});

// ...

// 4. Get Files for Canvas or KB (Query)
export const getFiles = query({
  args: {
    canvasId: v.optional(v.id("canvas")),
    kbId: v.optional(v.id("knowledgeBases"))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Return empty array instead of throwing for unauthenticated users
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      // Return empty array if user not found
      return [];
    }

    if (args.canvasId) {
      const canvas = await ctx.db.get(args.canvasId);
      if (!canvas || canvas.userId !== user._id) {
        // Return empty array if canvas not found or unauthorized
        return [];
      }
      return await ctx.db
        .query("files")
        .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
        .order("desc")
        .collect();
    }

    if (args.kbId) {
      const kb = await ctx.db.get(args.kbId);
      if (!kb || kb.userId !== user._id) {
        // Return empty array if KB not found or unauthorized (KB may have been deleted)
        return [];
      }

      return await ctx.db
        .query("files")
        .withIndex("by_kb", (q) => q.eq("kbId", args.kbId))
        .order("desc")
        .collect();
    }

    return [];
  },
});

// 9. Get Pending Files (Internal Query - called by Local Worker via wrapper)
export const getPendingFiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Local worker doesn't have auth context
    const files = await ctx.db
      .query("files")
      .withIndex("by_status", (q) => q.eq("status", "uploaded"))
      .collect();

    if (files.length > 0) {
      console.log(`[Files] getPendingFiles found ${files.length} files with status 'uploaded'`);
      for (const f of files) {
        console.log(`  - ${f.fileName} (id: ${f._id}, kbId: ${f.kbId || "none"})`);
      }
    }
    return files;
  },
});

export const publicGetPendingFiles = action({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.FILE_WORKER_SECRET) {
      throw new Error("Unauthorized");
    }
    const files = await ctx.runQuery(internal.system.files.getPendingFiles);
    return files;
  },
});

// 9. Get Files by IDs (Query - for bulk validation)
export const getFilesByIds = query({
  args: { fileIds: v.array(v.id("files")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    // Find the user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const files = [];
    for (const id of args.fileIds) {
      const file = await ctx.db.get(id);
      if (file && file.userId === user._id) {
        files.push(file);
      }
    }
    return files;
  },
});
// 10. Get Files by KB (Query)
export const listByKb = query({
  args: { kbId: v.id("knowledgeBases") },
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

    // Verify KB ownership (optional but good practice)
    const kb = await ctx.db.get(args.kbId);
    if (!kb || kb.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("files")
      .withIndex("by_kb", (q) => q.eq("kbId", args.kbId))
      .order("desc")
      .collect();
  },
});

export const getFileByS3KeyPublic = query({
  args: { s3Key: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    return await ctx.db
      .query("files")
      .withIndex("by_s3_key", (q) => q.eq("s3Key", args.s3Key))
      .unique();
  },
});

export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) {
      console.log(`[Files] File ${args.fileId} not found, skipping delete`);
      return;
    }

    // Get associated seeds and delete them (will cascade delete seedLinks)
    const seeds = await ctx.db
      .query("seeds")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .collect();

    console.log(`[Files] Deleting ${seeds.length} seeds for file ${args.fileId}`);

    for (const seed of seeds) {
      // Call internal mutation to delete seed (includes seedLinks cleanup)
      await ctx.runMutation(api.knowledge_garden.seeds.deleteSeed, { seedId: seed._id });
    }

    // Update KB file count if associated with KB
    if (file.kbId) {
      const kb = await ctx.db.get(file.kbId);
      if (kb) {
        await ctx.db.patch(file.kbId, {
          fileCount: Math.max(0, (kb.fileCount || 1) - 1),
          updatedAt: Date.now(),
        });
      }
    }

    // Delete the file record
    await ctx.db.delete(args.fileId);

    console.log(`[Files] Deleted file ${args.fileId}`);
  },
});

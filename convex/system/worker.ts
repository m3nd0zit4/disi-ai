import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const enqueueTask = mutation({
  args: {
    queueUrl: v.string(),
    messageBody: v.string(),
    messageGroupId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("workerQueue", {
      queueUrl: args.queueUrl,
      messageBody: args.messageBody,
      messageGroupId: args.messageGroupId,
      status: "pending",
      createdAt: Date.now(),
    });
    return taskId;
  },
});

export const dequeueTask = mutation({
  args: {},
  handler: async (ctx) => {
    const task = await ctx.db
      .query("workerQueue")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("asc")
      .first();

    if (!task) return null;

    await ctx.db.patch(task._id, {
      status: "processing",
      processedAt: Date.now(),
    });

    return task;
  },
});

export const completeTask = mutation({
  args: {
    taskId: v.id("workerQueue"),
    status: v.union(v.literal("completed"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      status: args.status,
    });
    // Optional: Delete completed tasks to keep DB clean
    if (args.status === "completed") {
        await ctx.db.delete(args.taskId);
    }
  },
});

export const getPendingTasks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("workerQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

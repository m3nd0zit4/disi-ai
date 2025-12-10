import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * !Update response status only
 * !Called by worker when starting to process
 */
export const updateResponseStatus = action({
  args: {
    responseId: v.id("modelResponses"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("error")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.messages.updateResponseStatus, {
      responseId: args.responseId,
      status: args.status,
    });
    
    return { success: true };
  },
});

/**
 * !Update complete response with content, tokens, cost, etc.
 * !Called by worker when finished processing
 */
export const updateResponseCompleted = action({
  args: {
    responseId: v.id("modelResponses"),
    content: v.string(),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("error")
    ),
    error: v.optional(v.string()),
    responseTime: v.optional(v.number()),
    tokens: v.optional(v.number()),
    cost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.messages.updateResponseInternal, {
      responseId: args.responseId,
      content: args.content,
      status: args.status,
      error: args.error,
      responseTime: args.responseTime,
      tokens: args.tokens,
      cost: args.cost,
    });
    
    return { success: true };
  },
});
'use node';

import { v } from 'convex/values';
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const generateResponse = internalAction({
  args: {
    responseId: v.id("modelResponses"),
    modelId: v.string(),
    subModelId: v.string(),
    userMessage: v.string(),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {

    //! This action should never be called because the worker system be used instead
    console.log(" generateResponse called but worker system be used instead")
    
    await ctx.runMutation(internal.messages.updateResponseInternal, {
      responseId: args.responseId,
      content: "",
      status: "error",
      error: "Worker system be used instead",
    })
  }
})
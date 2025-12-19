import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Create an orchestrated child response
 * Called by the worker when a reasoning model needs to execute a specialized task
 */
export const createOrchestratedResponse = internalMutation({
  args: {
    parentResponseId: v.id("modelResponses"),
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    userId: v.id("users"),
    modelId: v.string(),
    provider: v.string(),
    category: v.string(),
    providerModelId: v.string(),
    taskType: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify parent exists before creating child
    const parent = await ctx.db.get(args.parentResponseId);
    if (!parent) {
      throw new Error(`Parent response not found: ${args.parentResponseId}`);
    }

    // Create child response
    const childResponseId = await ctx.db.insert("modelResponses", {
      messageId: args.messageId,
      conversationId: args.conversationId,
      userId: args.userId,
      modelId: args.modelId,
      provider: args.provider,
      category: args.category,
      providerModelId: args.providerModelId,
      content: "",
      status: "pending",
      parentResponseId: args.parentResponseId,
      createdAt: Date.now(),
    });

    // Update parent's orchestration data
    const orchestrationData = parent.orchestrationData || {
      isOrchestrator: true,
      orchestratedTasks: [],
    };

    orchestrationData.orchestratedTasks = [
      ...(orchestrationData.orchestratedTasks || []),
      {
        taskType: args.taskType,
        modelId: args.modelId,
        status: "pending",
        responseId: childResponseId,
      },
    ];

    await ctx.db.patch(args.parentResponseId, {
      orchestrationData,
    });

    return childResponseId;
  },
});

/**
 * Update orchestration task status
 */
export const updateOrchestrationTask = internalMutation({
  args: {
    parentResponseId: v.id("modelResponses"),
    childResponseId: v.id("modelResponses"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentResponseId);
    if (!parent || !parent.orchestrationData) return;

    const orchestrationData = parent.orchestrationData;
    orchestrationData.orchestratedTasks = orchestrationData.orchestratedTasks?.map(
      (task) =>
        task.responseId === args.childResponseId
          ? { ...task, status: args.status }
          : task
    );

    await ctx.db.patch(args.parentResponseId, {
      orchestrationData,
    });
  },
});

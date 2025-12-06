import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ===== ENVIAR MENSAJE =====
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    models: v.array(
      v.object({
        modelId: v.string(),
        subModelId: v.string(),
      })
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

    // Verificar ownership de la conversación
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }

    // Verificar límites del plan
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const usage = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", user._id).eq("yearMonth", yearMonth)
      )
      .collect();

    const requestsThisMonth = usage.length;
    const limit = user.plan === "pro" ? 10000 : 100;

    if (requestsThisMonth >= limit) {
      throw new Error(
        `Has alcanzado el límite de ${limit} mensajes este mes. ${
          user.plan === "free" ? "Actualiza a PRO para obtener más." : ""
        }`
      );
    }

    // Crear mensaje del usuario
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      userId: user._id,
      role: "user",
      content: args.content,
      createdAt: Date.now(),
    });

    // Crear respuestas pendientes para cada modelo
    const responseIds = await Promise.all(
      args.models.map((model) =>
        ctx.db.insert("modelResponses", {
          messageId,
          conversationId: args.conversationId,
          userId: user._id,
          modelId: model.modelId,
          subModelId: model.subModelId,
          content: "",
          status: "pending",
          createdAt: Date.now(),
        })
      )
    );

    // Actualizar conversación
    await ctx.db.patch(args.conversationId, {
      messageCount: conversation.messageCount + 1,
      updatedAt: Date.now(),
      lastMessageAt: Date.now(),
    });

    // Generar título automático si es el primer mensaje
    if (conversation.messageCount === 0) {
      await ctx.scheduler.runAfter(0, internal.messages.generateTitle, {
        conversationId: args.conversationId,
        firstMessage: args.content,
      });
    }

    return {
      messageId,
      responseIds,
    };
  },
});

// ===== GENERAR TÍTULO AUTOMÁTICO =====
export const generateTitle = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    firstMessage: v.string(),
  },
  handler: async (ctx, args) => {
    // Generar título basado en el primer mensaje (máximo 50 caracteres)
    let title = args.firstMessage.substring(0, 50);
    if (args.firstMessage.length > 50) {
      title += "...";
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;

    await ctx.db.patch(args.conversationId, {
      title,
      updatedAt: Date.now(),
    });
  },
});

// ===== WATCH RESPONSES (Real-time) =====
export const watchResponses = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    const responses = await ctx.db
      .query("modelResponses")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    return responses;
  },
});

// ===== ACTUALIZAR RESPUESTA (Llamado por worker) =====
export const updateResponse = mutation({
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
    const response = await ctx.db.get(args.responseId);
    if (!response) {
      throw new Error("Response not found");
    }

    await ctx.db.patch(args.responseId, {
      content: args.content,
      status: args.status,
      error: args.error,
      responseTime: args.responseTime,
      tokens: args.tokens,
      cost: args.cost,
      completedAt: args.status === "completed" ? Date.now() : undefined,
    });

    // Si se completó, registrar uso
    if (args.status === "completed" && args.tokens && args.cost) {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      await ctx.db.insert("usageRecords", {
        userId: response.userId,
        conversationId: response.conversationId,
        modelId: response.modelId,
        subModelId: response.subModelId,
        tokens: args.tokens,
        cost: args.cost,
        timestamp: Date.now(),
        yearMonth,
      });

      // Actualizar totales de la conversación
      const conversation = await ctx.db.get(response.conversationId);
      if (conversation) {
        await ctx.db.patch(response.conversationId, {
          totalTokens: (conversation.totalTokens || 0) + args.tokens,
          totalCost: (conversation.totalCost || 0) + args.cost,
        });
      }
    }

    return { success: true };
  },
});

// ===== TOGGLE EXPANSION =====
export const toggleExpansion = mutation({
  args: { responseId: v.id("modelResponses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const response = await ctx.db.get(args.responseId);
    if (!response || response.userId !== user._id) {
      throw new Error("Response not found");
    }

    await ctx.db.patch(args.responseId, {
      isExpanded: !response.isExpanded,
    });

    return { isExpanded: !response.isExpanded };
  },
});

// ===== FEEDBACK =====
export const submitFeedback = mutation({
  args: {
    responseId: v.id("modelResponses"),
    type: v.union(v.literal("thumbs_up"), v.literal("thumbs_down")),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const response = await ctx.db.get(args.responseId);
    if (!response || response.userId !== user._id) {
      throw new Error("Response not found");
    }

    await ctx.db.insert("feedback", {
      userId: user._id,
      responseId: args.responseId,
      conversationId: response.conversationId,
      type: args.type,
      comment: args.comment,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});
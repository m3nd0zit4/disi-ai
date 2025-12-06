import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== CREAR CONVERSACIÓN =====
export const createConversation = mutation({
  args: {
    title: v.optional(v.string()),
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

    const conversationId = await ctx.db.insert("conversations", {
      userId: user._id,
      title: args.title || "Nueva conversación",
      models: args.models,
      messageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return conversationId;
  },
});

// ===== LISTAR CONVERSACIONES =====
export const listConversations = query({
  args: {
    limit: v.optional(v.number()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    let conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Filtrar archivadas
    if (args.archived !== undefined) {
      conversations = conversations.filter(
        (c) => (c.isArchived || false) === args.archived
      );
    }

    // Limitar
    if (args.limit) {
      conversations = conversations.slice(0, args.limit);
    }

    // Agregar último mensaje
    return Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation_and_created", (q) =>
            q.eq("conversationId", conv._id)
          )
          .order("desc")
          .first();

        return {
          ...conv,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
              }
            : null,
        };
      })
    );
  },
});

// ===== OBTENER CONVERSACIÓN POR ID =====
export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return null;

    const conversation = await ctx.db.get(args.conversationId);

    // Verificar ownership
    if (!conversation || conversation.userId !== user._id) {
      return null;
    }

    return conversation;
  },
});

// ===== OBTENER MENSAJES DE UNA CONVERSACIÓN =====
export const getMessages = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    // Verificar ownership de la conversación
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      return [];
    }

    // Obtener mensajes
    let messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_and_created", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    if (args.limit) {
      messages = messages.slice(-args.limit);
    }

    // Para cada mensaje del usuario, obtener las respuestas de los modelos
    return Promise.all(
      messages.map(async (message) => {
        if (message.role === "user") {
          const responses = await ctx.db
            .query("modelResponses")
            .withIndex("by_message", (q) => q.eq("messageId", message._id))
            .collect();

          return {
            ...message,
            modelResponses: responses,
          };
        }

        return message;
      })
    );
  },
});

// ===== ACTUALIZAR TÍTULO =====
export const updateTitle = mutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ===== PIN/UNPIN CONVERSACIÓN =====
export const togglePin = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args.conversationId, {
      isPinned: !conversation.isPinned,
      updatedAt: Date.now(),
    });

    return { isPinned: !conversation.isPinned };
  },
});

// ===== ARCHIVAR CONVERSACIÓN =====
export const archiveConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args.conversationId, {
      isArchived: true,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ===== ELIMINAR CONVERSACIÓN =====
export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }

    // Eliminar todos los mensajes
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    for (const message of messages) {
      // Eliminar respuestas del modelo
      const responses = await ctx.db
        .query("modelResponses")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect();

      for (const response of responses) {
        await ctx.db.delete(response._id);
      }

      // Eliminar mensaje
      await ctx.db.delete(message._id);
    }

    // Eliminar conversación
    await ctx.db.delete(args.conversationId);

    return { success: true };
  },
});

// ===== BUSCAR CONVERSACIONES =====
export const searchConversations = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    const results = await ctx.db
      .query("conversations")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("userId", user._id)
      )
      .take(20);

    return results;
  },
});
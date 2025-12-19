import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// *Create conversation
export const createConversation = mutation({
  args: {
    title: v.optional(v.string()),
    models: v.array(
      v.object({
        modelId: v.string(),
        provider: v.string(),
        category: v.string(),
        providerModelId: v.string(),
        isEnabled: v.optional(v.boolean()), // From frontend
        specializedModels: v.optional(v.array(v.string())), // From frontend
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get or auto-create user (handles webhook failures)
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      console.warn(`User ${identity.subject} not found, auto-creating from identity`);
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: identity.email || "",
        name: identity.name || "Usuario",
        imageUrl: identity.pictureUrl,
        plan: "free",
        apiKeySource: "system",
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      });
      user = await ctx.db.get(userId);
      if (!user) throw new Error("Failed to create user");
    }

    const conversationId = await ctx.db.insert("conversations", {
      userId: user._id,
      title: args.title || "Nueva conversación",
      // Filter out frontend-only fields (isEnabled, specializedModels)
      models: args.models.map(m => ({
        modelId: m.modelId,
        provider: m.provider,
        category: m.category,
        providerModelId: m.providerModelId,
      })),
      messageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return conversationId;
  },
});

// *List conversations
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

    // Filter archived
    if (args.archived !== undefined) {
      conversations = conversations.filter(
        (c) => (c.isArchived || false) === args.archived
      );
    }

    // Limit conversations
    if (args.limit) {
      conversations = conversations.slice(0, args.limit);
    }

    // Add last message
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

// *Get conversation by ID
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

    // Verify ownership
    if (!conversation || conversation.userId !== user._id) {
      return null;
    }

    return conversation;
  },
});

// *Get messages from a conversation
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

    // Verify ownership
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      return [];
    }

    // Get messages
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

    // For each user message, get model responses
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

// *Update title
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

// *Pin/unpin conversation
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

// *Archive conversation
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

// *Delete conversation
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

    // Delete all messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    for (const message of messages) {
      // Delete model responses
      const responses = await ctx.db
        .query("modelResponses")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect();

      for (const response of responses) {
        await ctx.db.delete(response._id);
      }

      // Delete message
      await ctx.db.delete(message._id);
    }

    // Delete conversation
    await ctx.db.delete(args.conversationId);

    return { success: true };
  },
});

// *Search conversations
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
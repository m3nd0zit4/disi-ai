import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// *Create user (from Webhook) 
export const createUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.token !== process.env.CLERK_WEBHOOK_SECRET) {
      throw new Error("Unauthorized");
    }
    // ?Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      console.log("User already exists:", args.clerkId);
      return existing._id;
    }

    // ?Create new user
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      plan: "free",
      apiKeySource: "system",
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    });

    console.log("User created:", userId);
    return userId;
  },
});

// *Update user (from Webhook) 
export const updateUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.token !== process.env.CLERK_WEBHOOK_SECRET) {
      throw new Error("Unauthorized");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      updatedAt: Date.now(),
    });

    return user._id;
  },
});

// *Delete user (from Webhook) 
export const deleteUser = mutation({
  args: {
    clerkId: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      return;
    }

    await ctx.db.delete(user._id);
  },
});

// *Get current user 
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    //! NO intentar actualizar en un query - usar mutation separada
    return {
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      plan: user.plan,
      apiKeySource: user.apiKeySource,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEndDate: user.subscriptionEndDate,
    };
  },
});

//* Get user from clerk ID (api Gateway)
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) { return null; }

    return {
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      plan: user.plan,
      apiKeySource: user.apiKeySource,
    };
  }
})


// *Update last login (mutation separated)
export const updateLastLogin = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return;
    }

    await ctx.db.patch(user._id, {
      lastLoginAt: Date.now(),
    });
  },
});

// *Update API key source
export const updateApiKeySource = mutation({
  args: {
    source: v.union(v.literal("user"), v.literal("system")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    if (args.source === "user") {
      const apiKeys = await ctx.db
        .query("userApiKeys")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("hasKey"), true))
        .collect();

      if (apiKeys.length === 0) {
        throw new Error(
          "No tienes API keys configuradas. Configura al menos una antes de cambiar a modo 'user'."
        );
      }
    }

    await ctx.db.patch(user._id, {
      apiKeySource: args.source,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// *Get user stats
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const usage = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", user._id).eq("yearMonth", yearMonth)
      )
      .collect();

    const totalTokens = usage.reduce((sum, r) => sum + r.tokens, 0);
    const totalCost = usage.reduce((sum, r) => sum + r.cost, 0);
    const totalRequests = usage.length;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return {
      plan: user.plan,
      subscription: {
        status: user.subscriptionStatus,
        endDate: user.subscriptionEndDate,
      },
      usage: {
        requests: totalRequests,
        tokens: totalTokens,
        cost: totalCost,
      },
      limits: user.plan === "pro"
        ? { requests: 10000, tokens: 10000000 }
        : { requests: 100, tokens: 100000 },
      conversations: {
        total: conversations.length,
        pinned: conversations.filter((c) => c.isPinned).length,
      },
    };
  },
});
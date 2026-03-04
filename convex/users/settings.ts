import { v } from "convex/values";
import { mutation, query, internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Default garden settings for new users or when not configured
 */
const DEFAULT_GARDEN_SETTINGS = {
  isActive: false,
  feedMode: "manual" as const,
  defaultKbId: undefined as Id<"knowledgeBases"> | undefined,
  suggestThreshold: 0.6,
  autoThreshold: 0.8,
  duplicateThreshold: 0.95,
};

/** RLM defaults aligned with lib/rlm/types.ts DEFAULT_RLM_CONFIG */
const DEFAULT_RLM_SETTINGS = {
  mode: "simple" as const,
  tokenBudget: 16000,
  enableCache: true,
  enableReasoning: false,
  maxDepth: 3,
  maxChildCalls: 5,
};

/** AI feature defaults (Web Search, Thinking, RLM Full) */
const DEFAULT_AI_FEATURE_DEFAULTS = {
  webSearchEnabled: false,
  thinkingEnabled: false,
  rlmForceFullByDefault: false,
};

export type GardenSettings = typeof DEFAULT_GARDEN_SETTINGS;
export type RlmSettings = typeof DEFAULT_RLM_SETTINGS;
export type AiFeatureDefaults = typeof DEFAULT_AI_FEATURE_DEFAULTS;

// ===== QUERIES =====

/**
 * Get current user's garden settings
 */
export const getGardenSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return DEFAULT_GARDEN_SETTINGS;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return DEFAULT_GARDEN_SETTINGS;
    }

    // Merge with defaults to ensure all fields exist
    return {
      ...DEFAULT_GARDEN_SETTINGS,
      ...user.gardenSettings,
    };
  },
});


/**
 * Internal query for worker to get settings without auth
 */
export const internalGetGardenSettings = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return DEFAULT_GARDEN_SETTINGS;
    }

    return {
      ...DEFAULT_GARDEN_SETTINGS,
      ...user.gardenSettings,
    };
  },
});

// ===== MUTATIONS =====

/**
 * Update garden settings (partial update supported)
 */
export const updateGardenSettings = mutation({
  args: {
    isActive: v.optional(v.boolean()),
    feedMode: v.optional(
      v.union(
        v.literal("manual"),
        v.literal("assisted"),
        v.literal("automatic")
      )
    ),
    defaultKbId: v.optional(v.id("knowledgeBases")),
    suggestThreshold: v.optional(v.number()),
    autoThreshold: v.optional(v.number()),
    duplicateThreshold: v.optional(v.number()),
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

    // Get current settings or defaults
    const currentSettings = user.gardenSettings || DEFAULT_GARDEN_SETTINGS;

    // Validate thresholds
    if (args.suggestThreshold !== undefined && (args.suggestThreshold < 0 || args.suggestThreshold > 1)) {
      throw new Error("suggestThreshold must be between 0 and 1");
    }
    if (args.autoThreshold !== undefined && (args.autoThreshold < 0 || args.autoThreshold > 1)) {
      throw new Error("autoThreshold must be between 0 and 1");
    }
    if (args.duplicateThreshold !== undefined && (args.duplicateThreshold < 0 || args.duplicateThreshold > 1)) {
      throw new Error("duplicateThreshold must be between 0 and 1");
    }

    // If defaultKbId is provided, verify ownership
    if (args.defaultKbId) {
      const kb = await ctx.db.get(args.defaultKbId);
      if (!kb || kb.userId !== user._id) {
        throw new Error("Invalid Knowledge Base");
      }
    }

    // Merge new settings
    const newSettings = {
      isActive: args.isActive ?? currentSettings.isActive,
      feedMode: args.feedMode ?? currentSettings.feedMode,
      defaultKbId: args.defaultKbId ?? currentSettings.defaultKbId,
      suggestThreshold: args.suggestThreshold ?? currentSettings.suggestThreshold,
      autoThreshold: args.autoThreshold ?? currentSettings.autoThreshold,
      duplicateThreshold: args.duplicateThreshold ?? currentSettings.duplicateThreshold,
    };

    // Update user
    await ctx.db.patch(user._id, {
      gardenSettings: newSettings,
      updatedAt: Date.now(),
    });

    return newSettings;
  },
});

/**
 * Reset garden settings to defaults
 */
export const resetGardenSettings = mutation({
  args: {},
  handler: async (ctx) => {
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

    await ctx.db.patch(user._id, {
      gardenSettings: DEFAULT_GARDEN_SETTINGS,
      updatedAt: Date.now(),
    });

    return DEFAULT_GARDEN_SETTINGS;
  },
});

/**
 * Quick toggle for garden active state
 */
export const toggleGardenActive = mutation({
  args: {},
  handler: async (ctx) => {
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

    const currentSettings = user.gardenSettings || DEFAULT_GARDEN_SETTINGS;
    const newIsActive = !currentSettings.isActive;

    const newSettings = {
      ...currentSettings,
      isActive: newIsActive,
    };

    await ctx.db.patch(user._id, {
      gardenSettings: newSettings,
      updatedAt: Date.now(),
    });

    return newSettings;
  },
});

// ===== RLM SETTINGS =====

/**
 * Get current user's RLM settings
 */
export const getRlmSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return DEFAULT_RLM_SETTINGS;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || !user.rlmSettings) return DEFAULT_RLM_SETTINGS;
    return { ...DEFAULT_RLM_SETTINGS, ...user.rlmSettings };
  },
});

/**
 * Update RLM settings (partial)
 */
export const updateRlmSettings = mutation({
  args: {
    mode: v.optional(v.union(v.literal("simple"), v.literal("full"))),
    tokenBudget: v.optional(v.number()),
    enableCache: v.optional(v.boolean()),
    enableReasoning: v.optional(v.boolean()),
    maxDepth: v.optional(v.number()),
    maxChildCalls: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const current = { ...DEFAULT_RLM_SETTINGS, ...user.rlmSettings };
    const tokenBudget = args.tokenBudget ?? current.tokenBudget;
    if (tokenBudget < 1000 || tokenBudget > 128000) {
      throw new Error("tokenBudget must be between 1000 and 128000");
    }
    const maxDepth = args.maxDepth ?? current.maxDepth;
    if (maxDepth < 1 || maxDepth > 5) throw new Error("maxDepth must be between 1 and 5");
    const maxChildCalls = args.maxChildCalls ?? current.maxChildCalls;
    if (maxChildCalls < 1 || maxChildCalls > 10) throw new Error("maxChildCalls must be between 1 and 10");

    const newSettings = {
      mode: args.mode ?? current.mode,
      tokenBudget,
      enableCache: args.enableCache ?? current.enableCache,
      enableReasoning: args.enableReasoning ?? current.enableReasoning,
      maxDepth,
      maxChildCalls,
    };

    await ctx.db.patch(user._id, { rlmSettings: newSettings, updatedAt: Date.now() });
    return newSettings;
  },
});

// ===== AI FEATURE DEFAULTS =====

/**
 * Get current user's AI feature defaults
 */
export const getAiFeatureDefaults = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return DEFAULT_AI_FEATURE_DEFAULTS;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || !user.aiFeatureDefaults) return DEFAULT_AI_FEATURE_DEFAULTS;
    return { ...DEFAULT_AI_FEATURE_DEFAULTS, ...user.aiFeatureDefaults };
  },
});

/**
 * Update AI feature defaults (partial)
 */
export const updateAiFeatureDefaults = mutation({
  args: {
    webSearchEnabled: v.optional(v.boolean()),
    thinkingEnabled: v.optional(v.boolean()),
    rlmForceFullByDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const current = { ...DEFAULT_AI_FEATURE_DEFAULTS, ...user.aiFeatureDefaults };
    const newDefaults = {
      webSearchEnabled: args.webSearchEnabled ?? current.webSearchEnabled,
      thinkingEnabled: args.thinkingEnabled ?? current.thinkingEnabled,
      rlmForceFullByDefault: args.rlmForceFullByDefault ?? current.rlmForceFullByDefault,
    };

    await ctx.db.patch(user._id, { aiFeatureDefaults: newDefaults, updatedAt: Date.now() });
    return newDefaults;
  },
});

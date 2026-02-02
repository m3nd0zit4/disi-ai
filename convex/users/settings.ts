
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

export type GardenSettings = typeof DEFAULT_GARDEN_SETTINGS;

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

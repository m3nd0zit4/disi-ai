"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Get garden settings by user ID (for worker access with secret auth)
 */
export const workerGetGardenSettings = action({
  args: {
    secret: v.string(),
    userId: v.id("users")
  },
  handler: async (ctx, args) => {
    if (!secureCompare(args.secret, process.env.FILE_WORKER_SECRET)) {
      throw new Error("Unauthorized");
    }

    return await ctx.runQuery(internal.users.settings.internalGetGardenSettings, {
      userId: args.userId,
    });
  },
});

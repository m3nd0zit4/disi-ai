/**
 * One-time migration: set plan "free" -> "starter" for all users.
 * Run once from dashboard or script after deploying schema that includes "starter".
 */
import { internalMutation } from "./_generated/server";

export const migratePlanFreeToStarter = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let count = 0;
    for (const user of users) {
      if (user.plan === "free") {
        await ctx.db.patch(user._id, { plan: "starter" });
        count++;
      }
    }
    return { updated: count };
  },
});

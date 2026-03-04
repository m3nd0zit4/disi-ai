import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/upstash/redis";

export type RateLimitSlug = "execute" | "canvas-execute" | "upload" | "ai-request";

const LIMITS: Record<RateLimitSlug, { limit: number; window: string }> = {
  execute: { limit: 60, window: "60 s" },
  "canvas-execute": { limit: 60, window: "60 s" },
  upload: { limit: 30, window: "60 s" },
  "ai-request": { limit: 60, window: "60 s" },
};

const limiters: Partial<Record<RateLimitSlug, Ratelimit>> = {};

function getLimiter(slug: RateLimitSlug): Ratelimit | null {
  if (!redis) return null;
  if (!limiters[slug]) {
    const { limit, window } = LIMITS[slug];
    limiters[slug] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
    });
  }
  return limiters[slug];
}

/**
 * Check rate limit for the given identifier (e.g. Clerk userId).
 * Returns { success: true } or { success: false }.
 * When Redis is not configured, returns success: true (no limit).
 */
export async function checkRateLimit(
  identifier: string,
  slug: RateLimitSlug
): Promise<{ success: boolean }> {
  const limiter = getLimiter(slug);
  if (!limiter) return { success: true };
  const key = `ratelimit:${slug}:${identifier}`;
  const result = await limiter.limit(key);
  return { success: result.success };
}

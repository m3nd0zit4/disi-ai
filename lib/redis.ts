import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

if (!redisUrl) {
  console.warn("REDIS_URL or UPSTASH_REDIS_URL is not defined. Redis functionality will be disabled.");
}

export const redis = redisUrl ? new Redis(redisUrl) : null;

// Helper to get a subscriber client (ioredis clients can't do both pub and sub)
export const getRedisSubscriber = () => {
  return redisUrl ? new Redis(redisUrl) : null;
};

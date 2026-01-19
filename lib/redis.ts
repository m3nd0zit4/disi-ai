import Redis from "ioredis";
import { Redis as UpstashRedis } from "@upstash/redis";

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

if (!redisUrl) {
  console.warn("REDIS_URL or UPSTASH_REDIS_URL is not defined. Redis functionality will be disabled.");
}

export const redis = process.env.UPSTASH_REDIS_REST_URL 
  ? new UpstashRedis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// ioredis client for Pub/Sub (used in SSE)
export const ioredis = redisUrl ? new Redis(redisUrl) : null;

// Helper to get a subscriber client (ioredis clients can't do both pub and sub)
export const getRedisSubscriber = () => {
  return redisUrl ? new Redis(redisUrl) : null;
};

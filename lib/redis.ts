if (typeof window === "undefined" && !process.env.NEXT_RUNTIME) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("dotenv").config({ path: require("path").resolve(process.cwd(), ".env.local") });
}

import { Redis } from "@upstash/redis";
import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

//*Upstash Redis
export const upstashRedis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
}); 

//*IOredis for BullMQ
const redisUrl = process.env.REDIS_URL || "";
const isSecure = redisUrl.startsWith("rediss://");

export const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    family: 0, 
    tls: isSecure 
        ? { 
            rejectUnauthorized: process.env.NODE_ENV !== "development" 
          } 
        : undefined,
});

// *Jobs Definitions
export interface AIJobData {
    responseId: string;
    conversationId: string;
    userId: string;
    messageId: string;
    modelId: string; // "GPT", "CLAUDE", etc
    subModelId: string; // "GPT-4o-mini", "Claude-3-sonnet", etc
    userMessage: string;
    apiKey: string; // User API Key or System API Key
    timestamp: number;
    // Orchestration support
    specializedModels?: Array<{
        type: "image_generation" | "video_generation";
        modelId: string;
        providerModelId: string;
        modelName: string;
        provider: string;
    }>;
}

export interface AIJobResult {
    responseId: string;
    content: string;
    tokens: number;
    cost: number;
    timestamp: number;
    responseTime: number;
    error?: string;
}

// *Queues
export const aiRequestQueue = new Queue<AIJobData, AIJobResult>("ai-requests", {
    connection,
    defaultJobOptions: {
        attempts: 3, 
        backoff: {
            type: "exponential",
            delay: 2000, //? 2 seconds
        },
        removeOnComplete: {
            age: 3600, //? 1 hour of debugging
            count: 1000,
        },
        removeOnFail: {
            age: 86400, //? 1 day for analytics
        },
    },
})

// *Events
export const queueEvents = new QueueEvents("ai-requests", { connection });

// *Metrics 
export async function getQueueMetrics() {
    const [waiting, active, completed, failed] = await Promise.all([
        aiRequestQueue.getWaitingCount(),
        aiRequestQueue.getActiveCount(),
        aiRequestQueue.getCompletedCount(),
        aiRequestQueue.getFailedCount(),
    ])

    return { waiting, active, completed, failed };
}


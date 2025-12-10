import { Worker, Job } from "bullmq";
import { connection, AIJobData, AIJobResult } from "@/lib/redis";
import { getAIService } from "@/lib/aiServices";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
//
import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";

// !Load environment variables from .env file
config({ path: resolve(process.cwd(), ".env.local") });

if(!process.env.NEXT_PUBLIC_CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not defined");
}

if(!process.env.REDIS_URL) {
  console.error("REDIS_URL is not defined");
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// *Main worker
const worker = new Worker<AIJobData, AIJobResult>(
  "ai-requests",
  async (job: Job<AIJobData>) => {
    const { responseId, modelId, subModelId, userMessage, apiKey, timestamp } = job.data;

    console.log(`Processing job ${job.id} - ${modelId}/${subModelId}`);

    try {
      // Update status to "processing" in Convex
      await convex.action(api.actions.updateResponseStatus, {
        responseId: responseId as Id<"modelResponses">, 
        status: "processing",
      });

      // Get AI service
      const service = getAIService(modelId, apiKey);

      // Generate response (real API call)
      const startTime = Date.now();
      const result = await service.generateResponse({
        model: subModelId,
        messages: [{ role: "user", content: userMessage }],
        temperature: 0.7,
        maxTokens: 2000,
      });
      const responseTime = (Date.now() - startTime) / 1000;

      // Update Convex with result
      
      await convex.action(api.actions.updateResponseCompleted, {
        responseId: responseId as Id<"modelResponses">, 
        content: result.content,
        status: "completed",
        responseTime,
        tokens: result.tokens,
        cost: result.cost,
      });

      console.log(` Job ${job.id} completed successfully`);

      return {
        responseId,
        content: result.content,
        tokens: result.tokens,
        cost: result.cost,
        responseTime,
        timestamp,
      };

    } catch (error) {
      console.error(` Job ${job.id} failed:`, error);

      // Update error status in Convex
      try {
        await convex.action(api.actions.updateResponseCompleted, {
          responseId: responseId as Id<"modelResponses">, 
          content: "",
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } catch (updateError) {
        console.error(` Failed to update error status for job ${job.id}:`, updateError);
      }

      throw error; // BullMQ will handle the retry
    }
  },
  {
    connection,
    concurrency: 5, // Process 5 jobs simultaneously
    limiter: {
      max: 100, // Maximum 100 jobs
      duration: 60000, // per minute
    },
  }
);

// Event handlers
worker.on("completed", (job) => {
  console.log(` Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(` Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

console.log(" AI Worker started and listening for jobs...");

export default worker;
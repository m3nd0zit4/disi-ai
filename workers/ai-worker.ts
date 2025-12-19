import { Worker, Job } from "bullmq";
import { connection, AIJobData, AIJobResult } from "@/lib/redis";
import { getAIService } from "@/lib/aiServices";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { isInsufficientFundsError, INSUFFICIENT_FUNDS_MESSAGE } from "@/lib/ai-errors";
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
    const { responseId, modelId, subModelId, userMessage, apiKey, timestamp, specializedModels } = job.data;

    console.log(`🔄 Processing job ${job.id} - ${modelId}/${subModelId}`);

    try {
      // STEP 1: Update status to "processing"
      await convex.action(api.actions.updateResponseStatus, {
        responseId: responseId as Id<"modelResponses">, 
        status: "processing",
      });

      // Get AI service
      const service = getAIService(modelId, apiKey);
      const startTime = Date.now();

      // STEP 2: Check if orchestration is needed
      const hasSpecializedModels = specializedModels && specializedModels.length > 0;
      
      if (hasSpecializedModels) {
        console.log(`🎯 Orchestration mode: analyzing with ${specializedModels.length} specialized models available`);
        
        // Analyze if orchestration is needed
        const orchestrationResult = await service.analyzeOrchestration({
          model: subModelId,
          messages: [{ role: "user", content: userMessage }],
          temperature: 0.7,
          maxTokens: 2000,
          availableTools: specializedModels,
          userIntent: userMessage,
        });

        const responseTime = (Date.now() - startTime) / 1000;

        // STEP 3: Update with text response
        await convex.action(api.actions.updateResponseCompleted, {
          responseId: responseId as Id<"modelResponses">,
          content: orchestrationResult.textResponse,
          status: orchestrationResult.needsOrchestration ? "processing" : "completed",
          responseTime,
          tokens: Math.ceil(orchestrationResult.textResponse.length / 4), // Estimate
          cost: 0.001, // TODO: Calculate actual cost
        });

        // STEP 4: Execute orchestrated tasks if needed
        if (orchestrationResult.needsOrchestration && orchestrationResult.tasks) {
          console.log(`🚀 Executing ${orchestrationResult.tasks.length} orchestrated tasks`);
          
          for (const task of orchestrationResult.tasks) {
            try {
              console.log(`  📸 Task: ${task.taskType} - ${task.prompt.substring(0, 50)}...`);
              
              // Create child response in Convex
              const childResponseId = await convex.mutation(
                api.orchestration.createOrchestratedResponse as any,
                {
                  parentResponseId: responseId as Id<"modelResponses">,
                  conversationId: job.data.conversationId as Id<"conversations">,
                  messageId: job.data.messageId as Id<"messages">,
                  userId: job.data.userId as Id<"users">,
                  modelId: task.modelId,
                  provider: specializedModels.find(m => m.modelId === task.modelId)?.provider || modelId,
                  category: task.taskType,
                  providerModelId: task.providerModelId,
                  taskType: task.taskType,
                }
              );

              // Update child status to processing
              await convex.action(api.actions.updateResponseStatus, {
                responseId: childResponseId as Id<"modelResponses">,
                status: "processing",
              });

              // Get service for specialized model (might be different provider)
              const specializedTool = specializedModels.find(m => m.modelId === task.modelId);
              const specializedService = specializedTool 
                ? getAIService(specializedTool.provider, apiKey)
                : service;

              // Generate media
              const mediaStartTime = Date.now();
              let mediaResult;
              
              if (task.taskType === "image") {
                mediaResult = await specializedService.generateImage({
                  model: task.providerModelId,
                  prompt: task.prompt,
                });
              } else if (task.taskType === "video") {
                mediaResult = await specializedService.generateVideo({
                  model: task.providerModelId,
                  prompt: task.prompt,
                });
              }

              const mediaResponseTime = (Date.now() - mediaStartTime) / 1000;

              // Update child response with result
              if (mediaResult) {
                await convex.action(api.actions.updateResponseCompleted, {
                  responseId: childResponseId as Id<"modelResponses">,
                  content: task.reasoning,
                  status: "completed",
                  mediaUrl: mediaResult.mediaUrl,
                  responseTime: mediaResponseTime,
                  tokens: 0, // Media generation doesn't use tokens
                  cost: 0.01, // TODO: Calculate actual cost
                });

                console.log(`  ✅ Task completed: ${task.taskType}`);
              }

              // Update orchestration task status
              await convex.mutation(
                api.orchestration.updateOrchestrationTask as any,
                {
                  parentResponseId: responseId as Id<"modelResponses">,
                  childResponseId: childResponseId as Id<"modelResponses">,
                  status: "completed",
                }
              );

            } catch (taskError) {
              console.error(`  ❌ Task failed:`, taskError);
              // Continue with other tasks even if one fails
            }
          }

          // Mark parent as fully completed
          await convex.action(api.actions.updateResponseStatus, {
            responseId: responseId as Id<"modelResponses">,
            status: "completed",
          });
        }

      } else {
        // No orchestration needed - simple text response
        console.log(`💬 Simple mode: generating text response`);
        
        const result = await service.generateResponse({
          model: subModelId,
          messages: [{ role: "user", content: userMessage }],
          temperature: 0.7,
          maxTokens: 2000,
        });
        
        const responseTime = (Date.now() - startTime) / 1000;

        await convex.action(api.actions.updateResponseCompleted, {
          responseId: responseId as Id<"modelResponses">,
          content: result.content,
          status: "completed",
          responseTime,
          tokens: result.tokens,
          cost: result.cost,
        });
      }

      console.log(`✅ Job ${job.id} completed successfully`);

      return {
        responseId,
        content: "Completed",
        tokens: 0,
        cost: 0,
        responseTime: (Date.now() - startTime) / 1000,
        timestamp,
      };

    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);

      const isFundsError = isInsufficientFundsError(error);
      const finalErrorMessage = isFundsError 
        ? INSUFFICIENT_FUNDS_MESSAGE 
        : (error instanceof Error ? error.message : "Unknown error");

      // Update error status in Convex
      try {
        await convex.action(api.actions.updateResponseCompleted, {
          responseId: responseId as Id<"modelResponses">,
          content: "",
          status: "error",
          error: finalErrorMessage,
        });
      } catch (updateError) {
        console.error(`❌ Failed to update error status for job ${job.id}:`, updateError);
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
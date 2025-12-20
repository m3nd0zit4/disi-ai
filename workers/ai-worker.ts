import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, Message } from "@aws-sdk/client-sqs";
import { getAIService } from "@/lib/aiServices";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { isInsufficientFundsError, INSUFFICIENT_FUNDS_MESSAGE } from "@/lib/ai-errors";
import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

let isShuttingDown = false;

process.on("SIGTERM", () => {
  log("INFO", "Received SIGTERM, initiating graceful shutdown...");
  isShuttingDown = true;
});

process.on("SIGINT", () => {
  log("INFO", "Received SIGINT, initiating graceful shutdown...");
  isShuttingDown = true;
});

const QUEUE_URLS = [
  process.env.SQS_QUEUE_URL_PRO!,
  process.env.SQS_QUEUE_URL_FREE!,
].filter(Boolean);

function log(level: "INFO" | "WARN" | "ERROR", message: string, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
  console.log(`[${timestamp}] [${level}] ${message}${contextStr}`);
}

async function processMessage(message: Message, queueUrl: string) {
  if (!message.Body) {
    log("WARN", `Message ${message.MessageId} has no body. Deleting message.`);
    await sqsClient.send(new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle!,
    }));
    return;
  }

  let data;
  try {
    data = JSON.parse(message.Body);
  } catch (parseError) {
    log("ERROR", `Failed to parse message ${message.MessageId}`, { 
      error: parseError instanceof Error ? parseError.message : parseError,
      bodyPreview: message.Body.substring(0, 100) + (message.Body.length > 100 ? "..." : "")
    });
    
    // Delete malformed message to prevent retry storms
    await sqsClient.send(new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle!,
    }));
    return;
  }

  const { responseId, modelId, provider, subModelId, userMessage, apiKey, specializedModels, userId, conversationId } = data;

  log("INFO", `Processing message ${message.MessageId}`, { 
    modelId, 
    provider, 
    subModelId, 
    userId, 
    conversationId,
    responseId
  });

  try {
    // STEP 1: Update status to "processing"
    const statusResult = await convex.action(api.actions.updateResponseStatus, {
      responseId: responseId as Id<"modelResponses">, 
      status: "processing",
    });

    if (statusResult?.error === "Response not found") {
      log("WARN", `Response ${responseId} not found in database. Deleting zombie message.`, { messageId: message.MessageId });
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle!,
      }));
      return;
    }

    // STEP 2: Validate message body (handle old/malformed messages)
    if (!provider || !subModelId) {
      log("WARN", `Message ${message.MessageId} is missing provider or subModelId. Deleting malformed message.`, { 
        modelId, 
        provider, 
        subModelId 
      });
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle!,
      }));
      return;
    }

    // Use provider if available, fallback to modelId (for backward compatibility if needed)
    const targetProvider = provider || modelId;
    const service = getAIService(targetProvider, apiKey);
    const startTime = Date.now();

    // STEP 2: Check if orchestration is needed
    const hasSpecializedModels = specializedModels && specializedModels.length > 0;
    
    if (hasSpecializedModels) {
      // Use a capable model for orchestration (gpt-4o-mini for GPT) to ensure reliable tool calling
      // We use gpt-4o-mini because reasoning models (o1/gpt-5) often ignore tool_choice: "required"
      const orchestrationModelId = targetProvider === "GPT" ? "gpt-4o-mini" : subModelId;
      
      log("INFO", `Orchestration mode: analyzing with ${specializedModels.length} specialized models`, { responseId, orchestrationModelId });
      
      const orchestrationResult = await service.analyzeOrchestration({
        model: orchestrationModelId,
        messages: [{ role: "user", content: userMessage }],
        temperature: 0.7,
        maxTokens: 2000,
        availableTools: specializedModels,
        userIntent: userMessage,
      });

      log("INFO", `Orchestration result`, { 
        needsOrchestration: orchestrationResult.needsOrchestration,
        tasksCount: orchestrationResult.tasks?.length || 0,
        textResponse: orchestrationResult.textResponse.substring(0, 50) + "..."
      });

      const responseTime = (Date.now() - startTime) / 1000;

      await convex.action(api.actions.updateResponseCompleted, {
        responseId: responseId as Id<"modelResponses">,
        content: orchestrationResult.textResponse,
        status: orchestrationResult.needsOrchestration ? "processing" : "completed",
        responseTime,
        tokens: Math.ceil(orchestrationResult.textResponse.length / 4),
        cost: 0.001,
      });

      if (orchestrationResult.needsOrchestration && orchestrationResult.tasks) {
        log("INFO", `Orchestration tasks found: ${orchestrationResult.tasks.length}`, { responseId });
        
        for (const task of orchestrationResult.tasks) {
          try {
            log("INFO", `Executing task: ${task.taskType}`, { taskModel: task.modelId });
            
            const childResponseId = await convex.action(
              api.actions.createOrchestratedResponse,
              {
                parentResponseId: responseId as Id<"modelResponses">,
                conversationId: data.conversationId as Id<"conversations">,
                messageId: data.messageId as Id<"messages">,
                userId: data.userId as Id<"users">,
                modelId: task.modelId,
                provider: specializedModels.find((m: { modelId: string; provider: string }) => m.modelId === task.modelId)?.provider || targetProvider,
                category: task.taskType,
                providerModelId: task.providerModelId,
                taskType: task.taskType,
              }
            );

            await convex.action(api.actions.updateResponseStatus, {
              responseId: childResponseId as Id<"modelResponses">,
              status: "processing",
            });

            const specializedTool = specializedModels.find((m: { modelId: string; provider: string }) => m.modelId === task.modelId);
            const specializedService = specializedTool 
              ? getAIService(specializedTool.provider, apiKey)
              : service;

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

            if (mediaResult) {
              await convex.action(api.actions.updateResponseCompleted, {
                responseId: childResponseId as Id<"modelResponses">,
                content: task.reasoning,
                status: "completed",
                mediaUrl: mediaResult.mediaUrl,
                responseTime: mediaResponseTime,
                tokens: 0,
                cost: 0.01,
              });
              log("INFO", `Task completed: ${task.taskType}`, { childResponseId });
            }

            await convex.action(api.actions.updateOrchestrationTask, {
              parentResponseId: responseId as Id<"modelResponses">,
              childResponseId: childResponseId as Id<"modelResponses">,
              status: "completed",
            });

          } catch (taskError) {
            log("ERROR", `Task failed: ${task.taskType}`, { error: taskError });
          }
        }

        await convex.action(api.actions.updateResponseStatus, {
          responseId: responseId as Id<"modelResponses">,
          status: "completed",
        });
      }

    } else {
      log("INFO", `Simple mode: generating text response (streaming)`, { responseId });
      
      // Call streaming API
      const stream = await service.generateStreamResponse({
        model: subModelId,
        messages: [{ role: "user", content: userMessage }],
        temperature: 0.7,
        maxTokens: 2000,
      });

      let fullContent = "";
      let tokenCount = 0;
      let lastUpdateTime = Date.now();
      const UPDATE_INTERVAL = 150; // Update DB every 150ms

      // Iterate over the stream
      for await (const chunk of stream) {
        const contentDelta = chunk.choices[0]?.delta?.content || "";
        if (contentDelta) {
          fullContent += contentDelta;
          tokenCount++; // Rough estimation, accurate count comes from usage if available or post-calc

          // Throttle updates to Convex
          const now = Date.now();
          if (now - lastUpdateTime > UPDATE_INTERVAL) {
            await convex.action(api.actions.updateResponseCompleted, {
              responseId: responseId as Id<"modelResponses">,
              content: fullContent,
              status: "processing", // Keep as processing while streaming
              responseTime: (now - startTime) / 1000,
              tokens: tokenCount,
              cost: 0.001, // Placeholder cost
            });
            lastUpdateTime = now;
          }
        }
      }
      
      const responseTime = (Date.now() - startTime) / 1000;

      // Final update with completed status
      await convex.action(api.actions.updateResponseCompleted, {
        responseId: responseId as Id<"modelResponses">,
        content: fullContent,
        status: "completed",
        responseTime,
        tokens: tokenCount, // Or calculate more accurately
        cost: 0.001 * (tokenCount / 1000), // Example cost calc
      });
    }

    // STEP 3: Delete message from SQS
    await sqsClient.send(new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle!,
    }));

    log("INFO", `Message ${message.MessageId} processed and deleted`);

  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    log("ERROR", `Message ${message.MessageId} failed`, { error: err.message || err });

    if (err.code === 'ECONNRESET') {
      log("WARN", `Connection reset detected. This might be a temporary network issue.`);
    }

    const isFundsError = isInsufficientFundsError(error);
    const finalErrorMessage = isFundsError 
      ? INSUFFICIENT_FUNDS_MESSAGE 
      : (err.message || "Unknown error");

    try {
      await convex.action(api.actions.updateResponseCompleted, {
        responseId: responseId as Id<"modelResponses">,
        content: "",
        status: "error",
        error: finalErrorMessage,
      });
    } catch (updateError) {
      log("ERROR", `Failed to update error status for message ${message.MessageId}`, { error: updateError });
    }

    // IMPORTANT: Delete message even on failure to prevent retry storms
    try {
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle!,
      }));
      log("INFO", `Message ${message.MessageId} deleted after failure`);
    } catch (deleteError) {
      log("ERROR", `Failed to delete message ${message.MessageId} after failure`, { error: deleteError });
    }
  }
}

async function pollQueues() {
  log("INFO", "AI Worker started and polling SQS queues...", { 
    queues: QUEUE_URLS.map(url => url.split('/').pop()) 
  });
  
  while (!isShuttingDown) {
    let messageReceived = false;

    for (const queueUrl of QUEUE_URLS) {
      try {
        const response = await sqsClient.send(new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 5, // Short wait to allow checking other queues
          VisibilityTimeout: 60,
        }));

        if (response.Messages && response.Messages.length > 0) {
          messageReceived = true;
          await processMessage(response.Messages[0], queueUrl);
          // If we got a message from a high-priority queue, break and start over to check high-priority again
          break; 
        }
      } catch (error) {
        log("ERROR", `Error polling queue ${queueUrl.split('/').pop()}`, { error });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (!messageReceived && !isShuttingDown) {
      // If no messages in any queue, wait a bit before next poll
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  log("INFO", "Worker shutdown complete");
}

pollQueues().catch(console.error);
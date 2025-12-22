import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, Message } from "@aws-sdk/client-sqs";
import { getAIService } from "@/lib/aiServices";
import { redis } from "@/lib/redis";
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
      // Iterate over the stream
      for await (const chunk of stream) {
        const contentDelta = chunk.choices[0]?.delta?.content || "";
        if (contentDelta) {
          fullContent += contentDelta;

          // Publish to Redis for real-time streaming
          if (redis) {
            try {
              const publishResult = await redis.publish(`stream:${responseId}`, JSON.stringify({
                content: contentDelta,
                status: "processing"
              }));
              if (publishResult === 0) {
                log("WARN", `No subscribers for stream:${responseId}`);
              }
            } catch (publishError) {
              log("ERROR", `Failed to publish to Redis for ${responseId}`, { error: publishError });
            }
          }
        }
      }
      
      const responseTime = (Date.now() - startTime) / 1000;

      // *Get actual token count from SDK or estimate
      // OpenAI SDK provides usage in the last chunk or via a separate property depending on version/config
      // For now, we'll use the estimate as a fallback if not found in the stream
      const estimatedTokens = Math.ceil(fullContent.length / 4);
      const finalTokenCount = estimatedTokens; // TODO: Pull from SDK if available in future refactor

      const cost = calculateCost(provider, subModelId, finalTokenCount);

      // Final update with completed status
      await convex.action(api.actions.updateResponseCompleted, {
        responseId: responseId as Id<"modelResponses">,
        content: fullContent,
        status: "completed",
        responseTime,
        tokens: finalTokenCount,
        cost,
      });

      // Signal completion to Redis
      if (redis) {
        try {
          await redis.publish(`stream:${responseId}`, JSON.stringify({
            status: "completed",
            fullContent
          }));
          log("INFO", `Completion signal sent to Redis for ${responseId}`);
        } catch (publishError) {
          log("ERROR", `Failed to publish completion to Redis for ${responseId}`, { error: publishError });
        }
      }
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

    // Signal error to Redis
    if (redis) {
      try {
        await redis.publish(`stream:${responseId}`, JSON.stringify({
          status: "error",
          error: finalErrorMessage
        }));
      } catch (publishError) {
        log("ERROR", `Failed to publish error to Redis for ${responseId}`, { error: publishError });
      }
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

/**
 * Calculates the estimated cost of an AI response
 */
function calculateCost(provider: string, subModelId: string, tokens: number): number {
  const pricing: Record<string, Record<string, number>> = {
    "GPT": {
      "gpt-4o": 0.005 / 1000,
      "gpt-4o-mini": 0.00015 / 1000,
      "gpt-4-turbo": 0.01 / 1000,
      "gpt-3.5-turbo": 0.0005 / 1000,
    },
    "Claude": {
      "claude-3-5-sonnet-20241022": 0.003 / 1000,
      "claude-3-opus-20240229": 0.015 / 1000,
      "claude-3-haiku-20240307": 0.00025 / 1000,
    },
    "Gemini": {
      "gemini-1.5-pro": 0.00125 / 1000,
      "gemini-1.5-flash": 0.000075 / 1000,
    },
    "Grok": {
      "grok-beta": 0.005 / 1000,
    },
    "DeepSeek": {
      "deepseek-chat": 0.00014 / 1000,
    }
  };

  const providerPricing = pricing[provider] || {};
  const pricePerToken = providerPricing[subModelId] || 0.001 / 1000; // Default fallback
  
  return tokens * pricePerToken;
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
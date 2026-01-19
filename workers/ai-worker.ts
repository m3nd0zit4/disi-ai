import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, Message } from "@aws-sdk/client-sqs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { getAIService } from "@/lib/aiServices";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { isInsufficientFundsError, INSUFFICIENT_FUNDS_MESSAGE } from "@/lib/ai-errors";
import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";
import { SPECIALIZED_MODELS } from "@/shared/ai-models";
import { buildReasoningPrompt } from "@/lib/reasoning/prompt";
import { distillContext } from "@/lib/reasoning/distillation";
import { ReasoningContext, ReasoningContextItem } from "@/lib/reasoning/types";
import { executeRLM, RLMMode } from "@/lib/rlm";

interface NodeExecutionInputs {
  prompt?: string;
  text?: string;
  modelId?: string;
  provider?: string;
  systemPrompt?: string;
  temperature?: number;
  context?: Array<unknown>;
  reasoningContext?: unknown;
  imageSize?: string;
  imageQuality?: string;
  imageBackground?: string;
  imageOutputFormat?: string;
  imageN?: number;
  imageModeration?: string;
  query?: string;
  // RLM options
  rlmEnabled?: boolean;
  rlmMode?: RLMMode;
}

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

const s3Client = new S3Client({
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
      error: parseError instanceof Error ? parseError.message : parseError
    });
    
    await sqsClient.send(new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle!,
    }));
    return;
  }

  const { executionId, nodeId } = data;

  // Detect if this is a node execution
  if (executionId && nodeId) {
    return await processNodeExecution(data, message, queueUrl);
  }

  log("WARN", `Received legacy or unknown message type. Deleting.`, { messageId: message.MessageId });
  await sqsClient.send(new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: message.ReceiptHandle!,
  }));
}

async function withRetry<T>(fn: () => Promise<T>, name: string, retries = 3, delay = 1000): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isFetchError = error instanceof Error && (error.message.includes("fetch failed") || error.message.includes("ETIMEDOUT"));
      if (isFetchError && i < retries - 1) {
        log("WARN", `Retrying ${name} (${i + 1}/${retries}) due to network error: ${error instanceof Error ? error.message : String(error)}`);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function processNodeExecution(data: {
  executionId: string;
  nodeId: string;
  nodeType: string;
  canvasId: string;
  inputs: NodeExecutionInputs;
  apiKey?: string;
}, message: Message, queueUrl: string) {
  const { executionId, nodeId, nodeType, canvasId, inputs, apiKey } = data;

  log("INFO", `Processing node execution ${nodeId}`, { executionId, nodeType });

  try {
    // 1. Update node status to "running" in execution record
    await withRetry(() => convex.mutation(api.canvasExecutions.updateNodeExecution, {
      executionId: executionId as Id<"canvasExecutions">,
      nodeId,
      status: "running",
    }), "updateNodeExecution (running)");

    // Update node data status to "thinking" on the canvas
    await withRetry(() => convex.mutation(api.canvas.updateNodeDataInternal, {
      canvasId: canvasId as Id<"canvas">,
      nodeId,
      data: { status: "thinking" },
    }), "updateNodeDataInternal (thinking)");

    let result: {
      text: string;
      tokens: number;
      cost: number;
    } | null = null;

    // 2. Execute based on node type
    switch (nodeType) {
      case "chatInput":
      case "aiModel":
      case "display":
      case "response": {
        const { prompt, text, modelId, provider, systemPrompt, temperature } = inputs;
        
        // Fallback to environment variables if apiKey is not provided in the message
        let effectiveApiKey = apiKey;
        if (!effectiveApiKey) {
          const providerUpper = ((provider as string) || "openai").toUpperCase();
          effectiveApiKey = process.env[`${providerUpper}_API_KEY`];
        }

        const service = getAIService((provider as string) || "openai", effectiveApiKey || "");
        
        const modelDef = SPECIALIZED_MODELS.find(m => m.id === modelId);
        const isImageModel = modelDef?.category === "image";
        const isVideoModel = modelDef?.category === "video";
        // Handle Image Generation
        if (isImageModel) {
           // Use providerModelId if available, otherwise modelId
           const targetModel = modelDef?.providerModelId || modelId || "dall-e-3";
           const isGptImage = targetModel.includes("gpt-image");
           
           log("INFO", `Generating image with model ${targetModel}`);
           
           await withRetry(() => convex.mutation(api.canvas.updateNodeDataInternal, {
              canvasId: canvasId as Id<"canvas">,
              nodeId,
              data: { status: "thinking" }, // Use thinking state while generating
            }), "updateNodeDataInternal (image thinking)");

           const { 
             imageSize, 
             imageQuality, 
             imageBackground, 
             imageOutputFormat, 
             imageN,
             imageModeration
           } = inputs;

           const response = await service.generateImage({
             model: targetModel,
             prompt: (prompt as string) || (text as string) || "",
             size: (imageSize as string) || "1024x1024",
             quality: (imageQuality as string) || (isGptImage ? undefined : "standard"),
             background: imageBackground as string | undefined,
             outputFormat: imageOutputFormat as string | undefined,
             n: imageN as number,
             moderation: imageModeration as string | undefined,
           });

           // Upload to S3
           let mediaStorageId = "";
           if (response.mediaUrl) {
             try {
               const imageRes = await fetch(response.mediaUrl);
               const arrayBuffer = await imageRes.arrayBuffer();
               const buffer = Buffer.from(arrayBuffer);
               const contentType = imageRes.headers.get("content-type") || "image/png";
               
               const fileName = `${uuidv4()}.png`; // Assuming PNG for now or derive from content-type
               const key = `generated/${fileName}`;
               
               await s3Client.send(new PutObjectCommand({
                 Bucket: process.env.AWS_S3_BUCKET_NAME,
                 Key: key,
                 Body: buffer,
                 ContentType: contentType,
               }));
               
               mediaStorageId = key;
               log("INFO", `Uploaded generated image to S3: ${key}`);
             } catch (uploadError) {
               log("ERROR", "Failed to upload generated image to S3", { error: uploadError });
               // Throw error to prevent falling back to saving large data in Convex
               throw new Error(`Failed to upload generated image to S3: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
             }
           }

           const markdownImage = `![Generated Image](${mediaStorageId ? "s3://" + mediaStorageId : response.mediaUrl})`;
           
           await withRetry(() => convex.mutation(api.canvas.updateNodeDataInternal, {
              canvasId: canvasId as Id<"canvas">,
              nodeId,
              data: { 
                text: markdownImage, 
                mediaUrl: null, // Don't save the large URL/base64
                mediaStorageId: mediaStorageId,
                status: "complete",
                type: "image",
              },
            }), "updateNodeDataInternal (image complete)");

            result = {
              text: markdownImage,
              tokens: 0,
              cost: 0 // TODO: Calculate cost
            };
            break;
        }

        // Handle Video Generation
        if (isVideoModel) {
            const targetModel = modelDef?.providerModelId || modelId || "sora-2";
            
            log("INFO", `Generating video with model ${targetModel}`);

            await withRetry(() => convex.mutation(api.canvas.updateNodeDataInternal, {
              canvasId: canvasId as Id<"canvas">,
              nodeId,
              data: { status: "thinking" },
            }), "updateNodeDataInternal (video thinking)");

            const response = await service.generateVideo({
              model: targetModel,
              prompt: (prompt as string) || (text as string) || "",
            });

            // Video generation result formatting
            await withRetry(() => convex.mutation(api.canvas.updateNodeDataInternal, {
              canvasId: canvasId as Id<"canvas">,
              nodeId,
              data: { 
                text: `### Generated Video\n\n[Click to watch video](${response.mediaUrl})`, 
                mediaUrl: response.mediaUrl,
                status: "complete" 
              },
            }), "updateNodeDataInternal (video complete)");

            result = {
              text: response.mediaUrl,
              tokens: 0,
              cost: 0 // TODO: Calculate cost
            };
            break;
        }

        // Handle Text/Chat Generation (Default)
        
        // Build context using the reasoning logic
        const rawContext: ReasoningContext = (inputs.reasoningContext as ReasoningContext) || {
            targetNodeId: nodeId,
            items: (inputs.context as ReasoningContextItem[]) || []
        };

        log("INFO", `AI Worker context received`, { 
          itemCount: rawContext.items.length,
          targetNodeId: nodeId
        });

        const userPrompt = prompt || text || "";

        // ========== RLM EXECUTION PATH ==========
        // RLM is the new default for text generation
        const useRLM = inputs.rlmEnabled !== false; // Default to enabled
        
        if (useRLM) {
          log("INFO", `Using RLM execution (mode: ${inputs.rlmMode || 'auto'})`);
          
          const rlmResult = await executeRLM(userPrompt, rawContext, {
            config: {
              mode: inputs.rlmMode || (rawContext.items.length <= 2 ? "simple" : "full"),
              modelId: modelDef?.providerModelId || modelId || "gpt-4o",
              provider: provider || "openai",
              enableReasoning: false,
            },
            apiKey: effectiveApiKey,
            systemPrompt,
          });

          const fullText = rlmResult.content.markdown;
          const tokenCount = rlmResult.metadata?.tokensUsed || Math.ceil(fullText.length / 4);

          log("INFO", `RLM completed: mode=${rlmResult.metadata?.mode}, depth=${rlmResult.metadata?.depthUsed}, subCalls=${rlmResult.metadata?.subCalls}`);

          // Update node with RLM result
          await withRetry(() => convex.mutation(api.canvas.updateNodeDataInternal, {
            canvasId: canvasId as Id<"canvas">,
            nodeId,
            data: { text: fullText, status: "complete" },
          }), "updateNodeDataInternal (RLM complete)");

          result = {
            text: fullText,
            tokens: tokenCount,
            cost: 0,
          };
          break;
        }

        // ========== LEGACY STREAMING PATH (fallback) ==========
        // Apply 3-layer distillation
        const contextBudget = 4000;
        const distilledContext = distillContext(rawContext, { maxTokens: contextBudget });

        log("INFO", `Context distilled: ${rawContext.items.length} -> ${distilledContext.items.length} items (${distilledContext.totalTokens} tokens)`);

        const messages = buildReasoningPrompt(systemPrompt, distilledContext, userPrompt);

        if (messages.length === 0) {
          throw new Error("No messages to send to AI");
        }

        // 2.1 Start streaming with timeout protection
        const GENERATION_TIMEOUT_MS = 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          log("WARN", `Generation timed out for node ${nodeId}, aborting...`);
          controller.abort();
        }, GENERATION_TIMEOUT_MS);

        let stream;
        try {
          // Use providerModelId if available for text models too, to be safe
          const targetModel = modelDef?.providerModelId || modelId || "gpt-4o";
          
          stream = await service.generateStreamResponse({
            model: targetModel,
            messages: messages as { role: "system" | "user" | "assistant"; content: string }[],
            temperature: temperature || 0.7,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        let fullText = "";
        let tokenCount = 0;
        let lastUpdateTime = Date.now();
        let hasStartedStreaming = false;

        const providerLower = ((provider as string) || "openai").toLowerCase();
        
        // Normalize the stream to yield only text content
        const normalizedStream = (async function* () {
          for await (const chunk of stream) {
            if (providerLower === "google" || providerLower === "gemini") {
              yield chunk.text() || "";
            } else if (providerLower === "anthropic" || providerLower === "claude") {
              if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
                yield chunk.delta.text || "";
              } else if (chunk.type === 'message_start') {
                // Initial message metadata if needed
              }
            } else {
              // OpenAI, XAI, DeepSeek
              yield chunk.choices?.[0]?.delta?.content || "";
            }
          }
        })();

        for await (const content of normalizedStream) {
          if (content) {
            fullText += content;
            // Estimate tokens based on characters (~4 chars per token for English)
            tokenCount = Math.ceil(fullText.length / 4);

            if (!hasStartedStreaming) {
              hasStartedStreaming = true;
              await withRetry(() => convex.mutation(api.canvas.updateNodeDataInternal, {
                canvasId: canvasId as Id<"canvas">,
                nodeId,
                data: { status: "streaming" },
              }), "updateNodeDataInternal (start streaming)");
            }

            // Update Convex every 10 tokens or 500ms
            const now = Date.now();
            if (tokenCount % 10 === 0 || now - lastUpdateTime > 500) {
              await withRetry(() => convex.mutation(api.canvas.updateNodeDataInternal, {
                canvasId: canvasId as Id<"canvas">,
                nodeId,
                data: { text: fullText },
              }), "updateNodeDataInternal (streaming update)");
              lastUpdateTime = now;
            }
          }
        }

        // Final update to ensure text is complete and status is set
        await withRetry(() => convex.mutation(api.canvas.updateNodeDataInternal, {
          canvasId: canvasId as Id<"canvas">,
          nodeId,
          data: { text: fullText, status: "complete" },
        }), "updateNodeDataInternal (text complete)");

        result = {
          text: fullText,
          tokens: tokenCount,
          cost: 0,
        };
        break;
      }

      case "webSearch": {
        // TODO: Implement web search tool
        result = { 
          text: "Web search results for: " + inputs.query,
          tokens: 0,
          cost: 0
        };
        break;
      }

      default:
        throw new Error(`Unsupported node type: ${nodeType}`);
    }

    // 3. Update node status to "completed" in execution record
    await withRetry(() => convex.mutation(api.canvasExecutions.updateNodeExecution, {
      executionId: executionId as Id<"canvasExecutions">,
      nodeId,
      status: "completed",
      output: result,
    }), "updateNodeExecution (completed)");

    // 4. Delete message from SQS
    await sqsClient.send(new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle!,
    }));

    log("INFO", `Node ${nodeId} completed successfully`);

  } catch (error: unknown) {
    const isAbortError = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (isAbortError) {
      log("WARN", `Node ${nodeId} execution aborted/timed out`, { executionId });
    } else {
      log("ERROR", `Node ${nodeId} failed`, { error: errorMessage });
    }

    await withRetry(() => convex.mutation(api.canvasExecutions.updateNodeExecution, {
      executionId: executionId as Id<"canvasExecutions">,
      nodeId,
      status: "failed",
      error: isAbortError ? "Execution timed out" : errorMessage,
    }), "updateNodeExecution (failed)");

    // Update node data with error status and message
    const isInsufficientFunds = isInsufficientFundsError(error);
    await withRetry(() => convex.mutation(api.canvas.updateNodeDataInternal, {
      canvasId: canvasId as Id<"canvas">,
      nodeId,
      data: { 
        status: "error", 
        errorType: isInsufficientFunds ? "insufficient_funds" : "generic",
        error: isInsufficientFunds ? INSUFFICIENT_FUNDS_MESSAGE : errorMessage 
      },
    }), "updateNodeDataInternal (error)");
    // TODO: Better implement the configuration section and API error handling


    // Delete even on failure to prevent loops
    await sqsClient.send(new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle!,
    }));
  }
}

/**
 * Pricing logic moved to lib/pricing.ts
 */

async function pollQueues() {
  log("INFO", "AI Worker started and polling SQS queues...", { 
    queues: QUEUE_URLS.map(url => url.split('/').pop()) 
  });
  
  const useConvexQueue = process.env.USE_CONVEX_QUEUE === "true";
  if (useConvexQueue) {
    log("INFO", "Convex Queue fallback is ENABLED");
  }

  while (!isShuttingDown) {
    let messageReceived = false;

    // 1. Poll Convex Queue (Local Fallback)
    if (useConvexQueue) {
      try {
        const task = await convex.mutation(api.worker.dequeueTask, {});
        if (task) {
          messageReceived = true;
          log("INFO", `Processing task from Convex queue: ${task._id}`);
          
          // Adapt Convex task to SQS message format for processMessage
          const mockMessage: Message = {
            MessageId: task._id,
            Body: task.messageBody,
            ReceiptHandle: "convex-mock-handle",
          };

          try {
            await processMessage(mockMessage, task.queueUrl);
            await convex.mutation(api.worker.completeTask, { taskId: task._id, status: "completed" });
          } catch (error) {
            log("ERROR", `Failed to process Convex task ${task._id}`, { error });
            await convex.mutation(api.worker.completeTask, { taskId: task._id, status: "failed" });
          }
          
          // Continue to next iteration immediately if we got a message
          continue;
        }
      } catch (error) {
        log("ERROR", "Error polling Convex queue", { error });
      }
    }

    // 2. Poll SQS Queues
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
        // Only log SQS errors if we are NOT using Convex queue as primary
        if (!useConvexQueue) {
          log("ERROR", `Error polling queue ${queueUrl.split('/').pop()}`, { error });
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
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
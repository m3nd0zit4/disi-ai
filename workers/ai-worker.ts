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
import { modelRegistry } from "@/shared/ai";
import { buildReasoningPrompt } from "@/lib/reasoning/prompt";
import { distillContext } from "@/lib/reasoning/distillation";
import { ReasoningContext, ReasoningContextItem } from "@/lib/reasoning/types";
import { executeRLMStreaming, RLMMode, StreamStatus, RLMOutput } from "@/lib/rlm";
import { evaluateForKnowledge, shouldEvaluate } from "@/lib/knowledge/evaluator";
import { searchSimilar, storeEmbedding, generateEmbedding } from "@/lib/upstash/upstash-vector";

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
  videoAspectRatio?: string;
  videoResolution?: string;
  videoDuration?: number;
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
    await withRetry(() => convex.mutation(api.canvas.canvasExecutions.updateNodeExecution, {
      executionId: executionId as Id<"canvasExecutions">,
      nodeId,
      status: "running",
    }), "updateNodeExecution (running)");

    // Update node data status to "thinking" on the canvas
    await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
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

        // Get model definition first to determine the correct provider
        const modelDef = modelRegistry.getById(modelId || "");

        // Use the provider from the model definition if available, otherwise fall back to input provider
        const effectiveProviderName = modelDef?.provider || provider || "openai";

        log("INFO", `Model resolution: modelId=${modelId}, modelDef.provider=${modelDef?.provider}, inputProvider=${provider}, effective=${effectiveProviderName}`);

        // Fallback to environment variables if apiKey is not provided in the message
        let effectiveApiKey = apiKey;
        if (!effectiveApiKey) {
          // Map provider names to environment variable names
          const providerEnvMap: Record<string, string> = {
            "GPT": "OPENAI_API_KEY",
            "OPENAI": "OPENAI_API_KEY",
            "CLAUDE": "ANTHROPIC_API_KEY",
            "ANTHROPIC": "ANTHROPIC_API_KEY",
            "GEMINI": "GOOGLE_AI_API_KEY",
            "GOOGLE": "GOOGLE_AI_API_KEY",
            "GROK": "XAI_API_KEY",
            "XAI": "XAI_API_KEY",
            "DEEPSEEK": "DEEPSEEK_API_KEY",
          };
          // Use the effective provider name (from model definition or input)
          const providerUpper = ((effectiveProviderName as string) || "openai").toUpperCase();
          const envVarName = providerEnvMap[providerUpper] || `${providerUpper}_API_KEY`;
          effectiveApiKey = process.env[envVarName];
          log("INFO", `API key resolved: provider=${providerUpper}, envVar=${envVarName}, hasKey=${!!effectiveApiKey}`);
        }

        const service = getAIService((effectiveProviderName as string) || "openai", effectiveApiKey || "");
        const isImageModel = modelDef?.primaryCapability === "image.generation";
        const isVideoModel = modelDef?.primaryCapability === "video.generation";
        // Handle Image Generation
        if (isImageModel) {
           // Use providerModelId if available, otherwise modelId
           const targetModel = modelDef?.providerModelId || modelId || "dall-e-3";
           const isGptImage = targetModel.includes("gpt-image");
           
           log("INFO", `Generating image with model ${targetModel}`);
           
           await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
              canvasId: canvasId as Id<"canvas">,
              nodeId,
              data: { status: "thinking" }, // Use thinking state while generating
            }), "updateNodeDataInternal (image thinking)");

           const {
             imageSize,
             imageQuality,
             imageN,
             imageBackground,
           } = inputs;

           const validBackground = ["transparent", "opaque", "auto"].includes(imageBackground as string)
             ? imageBackground
             : "opaque";

           const response = await service.generateImage({
             model: targetModel,
             prompt: (prompt as string) || (text as string) || "",
             size: (imageSize as string) || "1024x1024",
             quality: (imageQuality as string) || "high",
             background: validBackground as "transparent" | "opaque" | "auto",
             outputFormat: "png",
             n: (imageN as number) || 1,
             moderation: "auto", // OpenAI only supports "auto" and "low"
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
           
           await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
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

            await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
              canvasId: canvasId as Id<"canvas">,
              nodeId,
              data: { status: "thinking" },
            }), "updateNodeDataInternal (video thinking)");

            const { 
              videoAspectRatio, 
              videoResolution,
              videoDuration 
            } = inputs;

            const response = await service.generateVideo({
              model: targetModel,
              prompt: (prompt as string) || (text as string) || "",
              aspectRatio: videoAspectRatio as string | undefined,
              resolution: videoResolution as string | undefined,
              duration: videoDuration as number | undefined,
              onProgress: async (progress: number) => {
                await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
                  canvasId: canvasId as Id<"canvas">,
                  nodeId,
                  data: { progress },
                }), "updateNodeDataInternal (video progress)");
              }
            });

            // Upload to S3
            let mediaStorageId = "";
            if (response.mediaUrl) {
              try {
                let buffer: Buffer;
                let contentType = "video/mp4";

                if (response.mediaUrl.startsWith("data:")) {
                  // Handle base64
                  const parts = response.mediaUrl.split(",");
                  const base64Data = parts[1];
                  buffer = Buffer.from(base64Data, "base64");
                  contentType = parts[0].split(";")[0].split(":")[1] || "video/mp4";
                  log("INFO", `Processing base64 video data, size: ${buffer.length} bytes`);
                } else {
                  // Handle URL
                  log("INFO", `Fetching video from URL: ${response.mediaUrl}`);
                  const videoRes = await fetch(response.mediaUrl);
                  if (!videoRes.ok) {
                    throw new Error(`Failed to fetch video from source: ${videoRes.status} ${videoRes.statusText}`);
                  }
                  const arrayBuffer = await videoRes.arrayBuffer();
                  buffer = Buffer.from(arrayBuffer);
                  contentType = videoRes.headers.get("content-type") || "video/mp4";
                  log("INFO", `Fetched video from URL, size: ${buffer.length} bytes, type: ${contentType}`);
                }
                
                const fileName = `${uuidv4()}.mp4`;
                const key = `generated/${fileName}`;
                
                log("INFO", `Uploading video to S3 bucket: ${process.env.AWS_S3_BUCKET_NAME}, key: ${key}`);
                await s3Client.send(new PutObjectCommand({
                  Bucket: process.env.AWS_S3_BUCKET_NAME,
                  Key: key,
                  Body: buffer,
                  ContentType: contentType,
                }));
                
                mediaStorageId = key;
                log("INFO", `Successfully uploaded generated video to S3: ${key}`);
              } catch (uploadError) {
                log("ERROR", "Failed to upload generated video to S3", { error: uploadError });
                throw new Error(`Failed to upload generated video to S3: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
              }
            }

            // Use the redirect API for the markdown link so it always works
            const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/file?key=${encodeURIComponent(mediaStorageId)}&redirect=true`;
            const markdownVideo = `### Generated Video\n\n[Download Video](${downloadUrl})`;

            // Video generation result formatting
            await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
              canvasId: canvasId as Id<"canvas">,
              nodeId,
              data: { 
                text: markdownVideo, 
                mediaUrl: null, // Don't save the large URL/base64
                mediaStorageId: mediaStorageId,
                status: "complete",
                type: "video",
                progress: 100
              },
            }), "updateNodeDataInternal (video complete)");

            result = {
              text: markdownVideo,
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

        // ========== RLM STREAMING EXECUTION PATH ==========
        // RLM with streaming is the new default for text generation
        // Supports both simple mode and full mode (planner → workers → aggregator)
        const useRLM = inputs.rlmEnabled !== false; // Default to enabled
        const rlmMode = inputs.rlmMode || (rawContext.items.length <= 2 ? "simple" : "full");

        if (useRLM) {
          log("INFO", `Using RLM streaming execution (mode: ${rlmMode})`, {
            modelId: modelDef?.providerModelId || modelId,
            provider: effectiveProviderName,
          });

          // Track last update time for throttling
          let lastConvexUpdate = Date.now();
          let accumulatedText = "";

          // Create streaming status callback that handles all phases
          const onStreamStatus = async (status: StreamStatus) => {
            const now = Date.now();

            // Determine update frequency based on phase
            const shouldUpdate =
              status.isFinal ||
              status.phase === "planning" ||
              status.phase === "researching" ||
              status.phase === "synthesizing" ||
              status.phase === "thinking" ||
              status.phase === "error" ||
              (status.phase === "streaming" && (now - lastConvexUpdate > 150 || status.currentText.length - accumulatedText.length > 100));

            if (shouldUpdate) {
              try {
                // Map RLM phases to node status
                const nodeStatus =
                  status.phase === "planning" ? "thinking" :
                  status.phase === "researching" ? "thinking" :
                  status.phase === "synthesizing" ? "thinking" :
                  status.phase === "thinking" ? "thinking" :
                  status.phase === "streaming" ? "streaming" :
                  status.phase === "error" ? "error" : "complete";

                // Build progress message for full mode phases
                let progressMessage = "";
                if (status.progress) {
                  const { currentStep, totalSteps, stepDescription, currentWorker, totalWorkers } = status.progress;
                  if (currentWorker && totalWorkers) {
                    progressMessage = `Step ${currentStep}/${totalSteps}: ${stepDescription} (${currentWorker}/${totalWorkers})`;
                  } else {
                    progressMessage = `Step ${currentStep}/${totalSteps}: ${stepDescription}`;
                  }
                }

                await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
                  canvasId: canvasId as Id<"canvas">,
                  nodeId,
                  data: {
                    text: status.currentText || accumulatedText,
                    status: nodeStatus,
                    ...(progressMessage ? { progressMessage } : {}),
                    ...(status.thinkingContent ? { thinkingContent: status.thinkingContent } : {}),
                    ...(status.error ? { error: status.error } : {}),
                  },
                }), "updateNodeDataInternal (streaming)");

                lastConvexUpdate = now;
                accumulatedText = status.currentText;
              } catch (updateError) {
                log("WARN", `Failed to update Convex during streaming: ${updateError}`);
              }
            }
          };

          // Use unified streaming RLM for both simple and full modes
          const rlmResult: RLMOutput = await executeRLMStreaming(userPrompt, rawContext, {
            config: {
              mode: rlmMode,
              modelId: modelDef?.providerModelId || modelId || "gpt-4o",
              provider: effectiveProviderName,
              enableReasoning: false,
            },
            apiKey: effectiveApiKey,
            systemPrompt,
            streaming: {
              enabled: true,
              onStatus: onStreamStatus,
              batchSize: 50,
              updateInterval: 100,
            },
          });

          const fullText = rlmResult.content.markdown;
          const tokenCount = rlmResult.metadata?.tokensUsed || Math.ceil(fullText.length / 4);
          const finalReasoning = rlmResult.reasoning?.summary ?? "";

          log("INFO", `RLM completed: mode=${rlmResult.metadata?.mode}, depth=${rlmResult.metadata?.depthUsed}, subCalls=${rlmResult.metadata?.subCalls}`);

          // Final update so UI has complete state (status, content, reasoning)
          await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
            canvasId: canvasId as Id<"canvas">,
            nodeId,
            data: {
              text: fullText,
              status: "complete",
              ...(finalReasoning ? { thinkingContent: finalReasoning } : {}),
              progressMessage: undefined,
            },
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
              await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
                canvasId: canvasId as Id<"canvas">,
                nodeId,
                data: { status: "streaming" },
              }), "updateNodeDataInternal (start streaming)");
            }

            // Update Convex every 10 tokens or 500ms
            const now = Date.now();
            if (tokenCount % 10 === 0 || now - lastUpdateTime > 500) {
              await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
                canvasId: canvasId as Id<"canvas">,
                nodeId,
                data: { text: fullText },
              }), "updateNodeDataInternal (streaming update)");
              lastUpdateTime = now;
            }
          }
        }

        // Final update to ensure text is complete and status is set
        await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
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
    await withRetry(() => convex.mutation(api.canvas.canvasExecutions.updateNodeExecution, {
      executionId: executionId as Id<"canvasExecutions">,
      nodeId,
      status: "completed",
      output: result,
    }), "updateNodeExecution (completed)");

    // 4. Process Knowledge Garden auto-feed (non-blocking)
    if (result?.text && nodeType === "response") {
      processKnowledgeGardenFeed({
        executionId: executionId as Id<"canvasExecutions">,
        canvasId: canvasId as Id<"canvas">,
        nodeId,
        content: result.text,
      }).catch((error) => {
        log("WARN", "Knowledge Garden feed processing failed (non-critical)", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    // 5. Delete message from SQS
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

    await withRetry(() => convex.mutation(api.canvas.canvasExecutions.updateNodeExecution, {
      executionId: executionId as Id<"canvasExecutions">,
      nodeId,
      status: "failed",
      error: isAbortError ? "Execution timed out" : errorMessage,
    }), "updateNodeExecution (failed)");

    // Update node data with error status and message
    const isInsufficientFunds = isInsufficientFundsError(error);
    await withRetry(() => convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
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
        const task = await convex.mutation(api.system.worker.dequeueTask, {});
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
            await convex.mutation(api.system.worker.completeTask, { taskId: task._id, status: "completed" });
          } catch (error) {
            log("ERROR", `Failed to process Convex task ${task._id}`, { error });
            await convex.mutation(api.system.worker.completeTask, { taskId: task._id, status: "failed" });
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

/**
 * Process Knowledge Garden auto-feed for AI responses
 * This runs asynchronously and doesn't block the main worker flow
 */
async function processKnowledgeGardenFeed(params: {
  executionId: Id<"canvasExecutions">;
  canvasId: Id<"canvas">;
  nodeId: string;
  content: string;
}) {
  const { executionId, canvasId, nodeId, content } = params;

  // Skip if content is too short
  if (!shouldEvaluate(content, 50)) {
    log("INFO", "KG: Content too short, skipping evaluation");
    return;
  }

  try {
    // 1. Get execution to find userId
    const execution = await convex.query(api.canvas.canvasExecutions.get, {
      executionId,
    });

    if (!execution) {
      log("WARN", "KG: Execution not found, skipping");
      return;
    }

    const userId = execution.userId;

    // 2. Get user's garden settings (via worker action with secret auth)
    const settings = await convex.action(api.users.settings_actions.workerGetGardenSettings, {
      secret: process.env.FILE_WORKER_SECRET!,
      userId,
    });

    // Skip if garden is inactive or manual mode
    if (!settings.isActive || settings.feedMode === "manual") {
      log("INFO", `KG: Garden inactive or manual mode for user, skipping`);
      return;
    }

    // 3. Evaluate content
    const evaluation = evaluateForKnowledge(content);
    log("INFO", `KG: Evaluation score ${evaluation.score.toFixed(2)}`, {
      reasons: evaluation.reasons.slice(0, 3),
    });

    // Determine threshold based on mode
    const threshold = settings.feedMode === "automatic"
      ? settings.autoThreshold
      : settings.suggestThreshold;

    if (evaluation.score < threshold) {
      log("INFO", `KG: Score ${evaluation.score.toFixed(2)} below threshold ${threshold}, skipping`);
      return;
    }

    // 4. Check for duplicates via vector similarity (if we have embedding capability)
    let similarSeedId: Id<"seeds"> | undefined;
    let similarityScore: number | undefined;

    try {
      const embedding = await generateEmbedding(content.slice(0, 8000));

      // Filter by user's default KB if set
      const filter = settings.defaultKbId
        ? `kbId = '${settings.defaultKbId}'`
        : undefined;

      const similar = await searchSimilar(embedding, 1, filter);

      if (similar.length > 0 && similar[0].score >= settings.duplicateThreshold) {
        log("INFO", `KG: Duplicate found (similarity ${similar[0].score.toFixed(3)}), skipping`);
        isDuplicate = true;
        return;
      }

      if (similar.length > 0 && similar[0].score >= 0.8) {
        // Near-duplicate, record for potential linking
        similarSeedId = similar[0].id as Id<"seeds">;
        similarityScore = similar[0].score;
        log("INFO", `KG: Similar seed found (${similar[0].score.toFixed(3)}), will create RELATED link`);
      }
    } catch (embedError) {
      // Embedding/search failed, continue without duplicate check
      log("WARN", "KG: Duplicate check failed, continuing", {
        error: embedError instanceof Error ? embedError.message : String(embedError),
      });
    }

    // 5. Create candidate or seed based on mode
    const secret = process.env.FILE_WORKER_SECRET;
    if (!secret) {
      log("ERROR", "KG: FILE_WORKER_SECRET not configured");
      return;
    }

    const candidateData = {
      secret,
      userId,
      kbId: settings.defaultKbId,
      canvasId,
      nodeId,
      executionId,
      title: evaluation.suggestedTitle,
      content,
      summary: content.slice(0, 500) + (content.length > 500 ? "..." : ""),
      evaluationScore: evaluation.score,
      evaluationReasons: evaluation.reasons,
      evaluationMetrics: {
        wordCount: evaluation.metrics.wordCount,
        sentenceCount: evaluation.metrics.sentenceCount,
        hasStructure: evaluation.metrics.hasStructure,
        hasCodeBlocks: evaluation.metrics.hasCodeBlocks,
        informationDensity: evaluation.metrics.informationDensity,
      },
      similarSeedId,
      similarityScore,
      // Only auto-approve if feedMode is automatic AND defaultKbId exists
      status: settings.feedMode === "automatic" && settings.defaultKbId ? "auto_approved" as const : "pending" as const,
      feedMode: settings.feedMode,
    };

    if (settings.feedMode === "automatic" && settings.defaultKbId) {
      // Auto mode: Create seed directly + embed
      // Use deterministic idempotency key for retry safety (based on executionId, nodeId, and title hash)
      const titleHash = evaluation.suggestedTitle.slice(0, 32).replace(/[^a-zA-Z0-9]/g, "");
      const idempotencyKey = `auto-${executionId}-${nodeId}-${titleHash}`;

      const seedId = await convex.action(api.knowledge_garden.seedCandidates.workerAutoCreateSeed, {
        secret,
        userId,
        kbId: settings.defaultKbId,
        canvasId,
        nodeId,
        executionId,
        title: evaluation.suggestedTitle,
        content,
        summary: content.slice(0, 500),
        tags: evaluation.suggestedTags,
        idempotencyKey,
      });

      // Store embedding for the new seed
      try {
        const embedding = await generateEmbedding(content.slice(0, 8000));
        await storeEmbedding(String(seedId), embedding, {
          kbId: String(settings.defaultKbId),
          title: evaluation.suggestedTitle,
          type: "seed",
          source: "auto-feed",
        });
        log("INFO", `KG: Auto-created seed ${seedId} with embedding`);
      } catch (embedError) {
        log("WARN", `KG: Created seed ${seedId} but embedding failed`, {
          error: embedError instanceof Error ? embedError.message : String(embedError),
        });
      }
    } else {
      // Assisted mode: Create candidate for user review
      await convex.action(api.knowledge_garden.seedCandidates.workerCreateCandidate, candidateData);
      log("INFO", "KG: Created candidate for assisted review");
    }
  } catch (error) {
    log("ERROR", "KG: Auto-feed processing failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - KG feed is non-critical
  }
}

pollQueues().catch(console.error);
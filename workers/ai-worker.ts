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

async function processNodeExecution(data: {
  executionId: string;
  nodeId: string;
  nodeType: string;
  canvasId: string;
  inputs: Record<string, unknown>;
  apiKey?: string;
}, message: Message, queueUrl: string) {
  const { executionId, nodeId, nodeType, canvasId, inputs, apiKey } = data;

  log("INFO", `Processing node execution ${nodeId}`, { executionId, nodeType });

  try {
    // 1. Update node status to "running" in execution record
    await convex.mutation(api.canvasExecutions.updateNodeExecution, {
      executionId: executionId as Id<"canvasExecutions">,
      nodeId,
      status: "running",
    });

    // Update node data status to "thinking" on the canvas
    await convex.mutation(api.canvas.updateNodeDataInternal, {
      canvasId: canvasId as Id<"canvas">,
      nodeId,
      data: { status: "thinking" },
    });

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
        const { prompt, text, modelId, provider, systemPrompt, temperature, context } = inputs as any;
        
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
           
           await convex.mutation(api.canvas.updateNodeDataInternal, {
              canvasId: canvasId as Id<"canvas">,
              nodeId,
              data: { status: "thinking" }, // Use thinking state while generating
            });

           const { 
             imageSize, 
             imageQuality, 
             imageBackground, 
             imageOutputFormat, 
             imageN,
             imageModeration
           } = inputs as any;

           const response = await service.generateImage({
             model: targetModel,
             prompt: (prompt as string) || (text as string) || "",
             size: (imageSize as string) || "1024x1024",
             quality: (imageQuality as string) || (isGptImage ? undefined : "standard"),
             background: imageBackground as any,
             outputFormat: imageOutputFormat as any,
             n: imageN as number,
             moderation: imageModeration as any,
           });

           const markdownImage = `![Generated Image](${response.mediaUrl})`;
           
           await convex.mutation(api.canvas.updateNodeDataInternal, {
              canvasId: canvasId as Id<"canvas">,
              nodeId,
              data: { 
                text: markdownImage, 
                mediaUrl: response.mediaUrl,
                status: "complete",
                type: "image",
              },
            });

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

            await convex.mutation(api.canvas.updateNodeDataInternal, {
              canvasId: canvasId as Id<"canvas">,
              nodeId,
              data: { status: "thinking" },
            });

            const response = await service.generateVideo({
              model: targetModel,
              prompt: (prompt as string) || (text as string) || "",
            });

            // const markdownVideo = `![Generated Video](${response.mediaUrl})`;
            
            await convex.mutation(api.canvas.updateNodeDataInternal, {
              canvasId: canvasId as Id<"canvas">,
              nodeId,
              data: { 
                text: `### Generated Video\n\n[Click to watch video](${response.mediaUrl})`, 
                mediaUrl: response.mediaUrl,
                status: "complete" 
              },
            });

            result = {
              text: response.mediaUrl,
              tokens: 0,
              cost: 0
            };
            break;
        }

        // Handle Text/Chat Generation (Default)
        
        // Build messages from context
        const messages = [];
        if (systemPrompt) {
          messages.push({ role: "system", content: systemPrompt });
        }

        if (context && Array.isArray(context)) {
          for (const ctxNode of context) {
            const role = ctxNode.type === "input" ? "user" : "assistant";
            messages.push({ role, content: ctxNode.content });
          }
        }

        // Add the current prompt/text
        const currentPrompt = prompt || text;
        if (currentPrompt) {
          messages.push({ role: "user", content: currentPrompt });
        }

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
            messages: messages as any[],
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

        for await (const chunk of stream) {
          const content = chunk.choices?.[0]?.delta?.content || "";
          if (content) {
            fullText += content;
            // Estimate tokens based on characters (~4 chars per token for English)
            tokenCount = Math.ceil(fullText.length / 4);

            if (!hasStartedStreaming) {
              hasStartedStreaming = true;
              await convex.mutation(api.canvas.updateNodeDataInternal, {
                canvasId: canvasId as Id<"canvas">,
                nodeId,
                data: { status: "streaming" },
              });
            }

            // Update Convex every 10 tokens or 500ms
            const now = Date.now();
            if (tokenCount % 10 === 0 || now - lastUpdateTime > 500) {
              await convex.mutation(api.canvas.updateNodeDataInternal, {
                canvasId: canvasId as Id<"canvas">,
                nodeId,
                data: { text: fullText },
              });
              lastUpdateTime = now;
            }
          }
        }

        // Final update to ensure text is complete and status is set
        await convex.mutation(api.canvas.updateNodeDataInternal, {
          canvasId: canvasId as Id<"canvas">,
          nodeId,
          data: { text: fullText, status: "complete" },
        });

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
    await convex.mutation(api.canvasExecutions.updateNodeExecution, {
      executionId: executionId as Id<"canvasExecutions">,
      nodeId,
      status: "completed",
      output: result,
    });

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

    await convex.mutation(api.canvasExecutions.updateNodeExecution, {
      executionId: executionId as Id<"canvasExecutions">,
      nodeId,
      status: "failed",
      error: isAbortError ? "Execution timed out" : errorMessage,
    });

    // Update node data with error status and message
    const isInsufficientFunds = isInsufficientFundsError(error);
    await convex.mutation(api.canvas.updateNodeDataInternal, {
      canvasId: canvasId as Id<"canvas">,
      nodeId,
      data: { 
        status: "error", 
        errorType: isInsufficientFunds ? "insufficient_funds" : "generic",
        error: isInsufficientFunds ? INSUFFICIENT_FUNDS_MESSAGE : errorMessage 
      },
    });
    // TODO: Implementar mejor la sección de configuración y manejo de errores de API


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
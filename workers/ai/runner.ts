import { resolve } from "path";
import { appendFileSync, mkdirSync } from "fs";
import { ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import type { Message } from "@aws-sdk/client-sqs";
import { getAIService } from "@/lib/aiServices";

// #region agent log
const DEBUG_LOG = resolve(process.cwd(), ".cursor", "debug.log");
function agentLog(p: Record<string, unknown>) {
  const line = JSON.stringify({ ...p, timestamp: Date.now(), sessionId: "debug-session" }) + "\n";
  try { try { mkdirSync(resolve(process.cwd(), ".cursor"), { recursive: true }); } catch (_) {} appendFileSync(DEBUG_LOG, line); } catch (_) {}
}
// #endregion
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { isInsufficientFundsError, INSUFFICIENT_FUNDS_MESSAGE } from "@/lib/ai-errors";
import { resolveModelId } from "@/lib/rlm/internal/model-resolver";
import { modelRegistry } from "@/shared/ai";
import {
  convex,
  sqsClient,
  s3Client,
  QUEUE_URLS,
  isShuttingDown,
  log,
  withRetry,
} from "./shared";
import type { NodeExecutionPayload, NodeExecutionResult } from "./types";
import { handleImageGeneration } from "./handlers/image";
import { handleVideoGeneration } from "./handlers/video";
import { handleTextGeneration } from "./handlers/text";
import { processKnowledgeGardenFeed } from "./handlers/kg-feed";

const PROVIDER_ENV_MAP: Record<string, string> = {
  GPT: "OPENAI_API_KEY",
  OPENAI: "OPENAI_API_KEY",
  CLAUDE: "ANTHROPIC_API_KEY",
  ANTHROPIC: "ANTHROPIC_API_KEY",
  GEMINI: "GOOGLE_AI_API_KEY",
  GOOGLE: "GOOGLE_AI_API_KEY",
  GROK: "XAI_API_KEY",
  XAI: "XAI_API_KEY",
  DEEPSEEK: "DEEPSEEK_API_KEY",
};

export async function processMessage(message: Message, queueUrl: string): Promise<void> {
  if (!message.Body) {
    log("WARN", `Message ${message.MessageId} has no body. Deleting message.`);
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle!,
      })
    );
    return;
  }

  let data: unknown;
  try {
    data = JSON.parse(message.Body);
  } catch (parseError) {
    log("ERROR", `Failed to parse message ${message.MessageId}`, {
      error: parseError instanceof Error ? parseError.message : parseError,
    });
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle!,
      })
    );
    return;
  }

  const payload = data as Record<string, unknown>;
  const { executionId, nodeId, nodeType, canvasId, inputs } = payload;

  // #region agent log
  agentLog({location:'workers/ai/runner.ts:processMessage',message:'processMessage parsed',data:{executionId:!!executionId,nodeId:!!nodeId,nodeType,hasInputs:!!inputs,keys:Object.keys(payload)},hypothesisId:'H3,H5'});
  // #endregion

  if (executionId && nodeId) {
    return await processNodeExecution(payload as NodeExecutionPayload, message, queueUrl);
  }

  log("WARN", "Received legacy or unknown message type. Deleting.", { messageId: message.MessageId });
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle!,
    })
  );
}

export async function processNodeExecution(
  data: NodeExecutionPayload,
  message: Message,
  queueUrl: string
): Promise<void> {
  const { executionId, nodeId, nodeType, canvasId, inputs, apiKey } = data;

  // #region agent log
  agentLog({location:'workers/ai/runner.ts:processNodeExecution',message:'processNodeExecution entry',data:{nodeId,nodeType,hasInputs:!!inputs,inputKeys:inputs?Object.keys(inputs):[]},hypothesisId:'H3,H4'});
  // #endregion

  log("INFO", `Processing node execution ${nodeId}`, { executionId, nodeType });

  try {
    await withRetry(
      () =>
        convex.mutation(api.canvas.canvasExecutions.updateNodeExecution, {
          executionId: executionId as Id<"canvasExecutions">,
          nodeId,
          status: "running",
        }),
      "updateNodeExecution (running)"
    );

    await withRetry(
      () =>
        convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
          canvasId: canvasId as Id<"canvas">,
          nodeId,
          data: { status: "thinking" },
        }),
      "updateNodeDataInternal (thinking)"
    );

    let result: NodeExecutionResult | null = null;

    switch (nodeType) {
      case "chatInput":
      case "aiModel":
      case "display":
      case "response": {
        const { prompt, text, modelId, provider } = inputs;
        const modelDef = modelRegistry.getById(modelId || "");
        const effectiveProviderName = (modelDef?.provider || provider || "openai") as string;

        log("INFO", `Model resolution: modelId=${modelId}, modelDef.provider=${modelDef?.provider}, inputProvider=${provider}, effective=${effectiveProviderName}`);

        let effectiveApiKey = apiKey;
        if (!effectiveApiKey) {
          const providerUpper = effectiveProviderName.toUpperCase();
          const envVarName = PROVIDER_ENV_MAP[providerUpper] || `${providerUpper}_API_KEY`;
          effectiveApiKey = process.env[envVarName];
          log("INFO", `API key resolved: provider=${providerUpper}, envVar=${envVarName}, hasKey=${!!effectiveApiKey}`);
        }

        const service = getAIService(effectiveProviderName, effectiveApiKey || "");
        const isImageModel = modelDef?.primaryCapability === "image.generation";
        const isVideoModel = modelDef?.primaryCapability === "video.generation";

        if (isImageModel) {
          const targetModel = modelDef?.providerModelId || modelId || "dall-e-3";
          result = await handleImageGeneration({
            canvasId: canvasId as Id<"canvas">,
            nodeId,
            inputs,
            service,
            targetModel,
            userId: (data as NodeExecutionPayload).userId as Id<"users"> | undefined,
            provider: effectiveProviderName,
            convex,
            api,
            s3Client,
            withRetry,
            log,
          });
        } else if (isVideoModel) {
          const targetModel = modelDef?.providerModelId || modelId || "sora-2";
          result = await handleVideoGeneration({
            canvasId: canvasId as Id<"canvas">,
            nodeId,
            inputs,
            service,
            targetModel,
            userId: (data as NodeExecutionPayload).userId as Id<"users"> | undefined,
            provider: effectiveProviderName,
            convex,
            api,
            s3Client,
            withRetry,
            log,
          });
        } else {
          const targetModelId = modelDef?.providerModelId || resolveModelId(modelId ?? undefined);
          result = await handleTextGeneration({
            canvasId: canvasId as Id<"canvas">,
            nodeId,
            inputs,
            service,
            targetModelId,
            effectiveProviderName,
            effectiveApiKey,
            userId: (data as NodeExecutionPayload).userId as Id<"users"> | undefined,
            convex,
            api,
            withRetry,
            log,
          });
        }
        break;
      }

      case "webSearch": {
        result = {
          text: "Web search results for: " + (inputs.query ?? ""),
          tokens: 0,
          cost: 0,
        };
        break;
      }

      default:
        throw new Error(`Unsupported node type: ${nodeType}`);
    }

    await withRetry(
      () =>
        convex.mutation(api.canvas.canvasExecutions.updateNodeExecution, {
          executionId: executionId as Id<"canvasExecutions">,
          nodeId,
          status: "completed",
          output: result,
        }),
      "updateNodeExecution (completed)"
    );

    if (result?.text && nodeType === "response") {
      processKnowledgeGardenFeed(
        {
          executionId: executionId as Id<"canvasExecutions">,
          canvasId: canvasId as Id<"canvas">,
          nodeId,
          content: result.text,
        },
        { convex, api, log }
      ).catch((error) => {
        log("WARN", "Knowledge Garden feed processing failed (non-critical)", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle!,
      })
    );

    log("INFO", `Node ${nodeId} completed successfully`);
  } catch (error: unknown) {
    const isAbortError =
      error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    const errorMessage = error instanceof Error ? error.message : String(error);

    // #region agent log
    agentLog({location:'workers/ai/runner.ts:processNodeExecution:catch',message:'processNodeExecution threw',data:{nodeId:data.nodeId,errorMessage,isAbortError},hypothesisId:'H3,H4'});
    // #endregion

    if (isAbortError) {
      log("WARN", `Node ${nodeId} execution aborted/timed out`, { executionId });
    } else {
      log("ERROR", `Node ${nodeId} failed`, { error: errorMessage });
    }

    await withRetry(
      () =>
        convex.mutation(api.canvas.canvasExecutions.updateNodeExecution, {
          executionId: executionId as Id<"canvasExecutions">,
          nodeId,
          status: "failed",
          error: isAbortError ? "Execution timed out" : errorMessage,
        }),
      "updateNodeExecution (failed)"
    );

    const isInsufficientFunds = isInsufficientFundsError(error);
    await withRetry(
      () =>
        convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
          canvasId: canvasId as Id<"canvas">,
          nodeId,
          data: {
            status: "error",
            errorType: isInsufficientFunds ? "insufficient_funds" : "generic",
            error: isInsufficientFunds ? INSUFFICIENT_FUNDS_MESSAGE : errorMessage,
          },
        }),
      "updateNodeDataInternal (error)"
    );

    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle!,
      })
    );
  }
}

export async function pollQueues(): Promise<void> {
  // #region agent log
  const queueNames = QUEUE_URLS.map((url) => url.split("/").pop());
  agentLog({location:'workers/ai/runner.ts:pollQueues',message:'pollQueues started',data:{queueCount:QUEUE_URLS.length,queueNames},hypothesisId:'H1,H2'});
  // #endregion
  log("INFO", "AI Worker started and polling SQS queues...", {
    queues: queueNames,
  });

  const useConvexQueue = process.env.USE_CONVEX_QUEUE === "true";
  if (useConvexQueue) {
    log("INFO", "Convex Queue fallback is ENABLED");
  }

  while (!isShuttingDown) {
    let messageReceived = false;

    if (useConvexQueue) {
      try {
        const task = await convex.mutation(api.system.worker.dequeueTask, {});
        if (task) {
          messageReceived = true;
          log("INFO", `Processing task from Convex queue: ${task._id}`);

          const mockMessage: Message = {
            MessageId: task._id,
            Body: task.messageBody,
            ReceiptHandle: "convex-mock-handle",
          };

          try {
            await processMessage(mockMessage, task.queueUrl);
            await convex.mutation(api.system.worker.completeTask, {
              taskId: task._id,
              status: "completed",
            });
          } catch (error) {
            log("ERROR", `Failed to process Convex task ${task._id}`, { error });
            await convex.mutation(api.system.worker.completeTask, {
              taskId: task._id,
              status: "failed",
            });
          }
          continue;
        }
      } catch (error) {
        log("ERROR", "Error polling Convex queue", { error });
      }
    }

    for (const queueUrl of QUEUE_URLS) {
      try {
        const response = await sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 5,
            VisibilityTimeout: 60,
          })
        );

        if (response.Messages && response.Messages.length > 0) {
          messageReceived = true;
          // #region agent log
          const msg = response.Messages[0];
          const bodyPreview = msg.Body ? String(msg.Body).slice(0, 200) : '';
          agentLog({location:'workers/ai/runner.ts:sqsReceived',message:'SQS message received',data:{messageId:msg.MessageId,bodyPreview},hypothesisId:'H2,H3'});
          // #endregion
          await processMessage(response.Messages[0], queueUrl);
          break;
        }
      } catch (error) {
        if (!useConvexQueue) {
          log("ERROR", `Error polling queue ${queueUrl.split("/").pop()}`, { error });
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    if (!messageReceived && !isShuttingDown) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  log("INFO", "Worker shutdown complete");
}

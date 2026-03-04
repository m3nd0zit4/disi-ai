import { S3Client } from "@aws-sdk/client-s3";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/convex-client";
import { getAIService } from "@/lib/aiServices";
import { isInsufficientFundsError, INSUFFICIENT_FUNDS_MESSAGE } from "@/lib/ai-errors";
import { resolveModelId } from "@/lib/rlm/internal/model-resolver";
import { modelRegistry } from "@/shared/ai";
import { handleImageGeneration } from "@/workers/ai/handlers/image";
import { handleVideoGeneration } from "@/workers/ai/handlers/video";
import { handleTextGeneration, handleResumeContinuation } from "@/workers/ai/handlers/text";
import { processKnowledgeGardenFeed } from "@/workers/ai/handlers/kg-feed";
import type { NodeExecutionPayload, NodeExecutionResult } from "@/workers/ai/types";

export type ResumeContinuationPayload = {
  canvasId: string;
  nodeId: string;
  executionId?: string;
  toolResult: unknown;
  pendingToolCall: { tool: string; args?: Record<string, unknown>; callId?: string };
  currentText: string;
  inputs: { modelId?: string; provider?: string; systemPrompt?: string };
  userId?: string;
};

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

function log(level: "INFO" | "WARN" | "ERROR", message: string, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
  console.log(`[${timestamp}] [${level}] ${message}${contextStr}`);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  name: string,
  retries = 3,
  delay = 1000
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isFetchError =
        error instanceof Error &&
        (error.message.includes("fetch failed") || error.message.includes("ETIMEDOUT"));
      if (isFetchError && i < retries - 1) {
        log(
          "WARN",
          `Retrying ${name} (${i + 1}/${retries}): ${error instanceof Error ? error.message : String(error)}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Run node execution (used by Inngest handler). Same logic as workers/ai/runner processNodeExecution
 * but without SQS message/queue handling.
 */
export async function runNodeExecution(data: NodeExecutionPayload): Promise<void> {
  const convex = getConvexClient();
  const { executionId, nodeId, nodeType, canvasId, inputs, apiKey, userId } = data;

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

        let effectiveApiKey = apiKey;
        if (!effectiveApiKey) {
          const providerUpper = effectiveProviderName.toUpperCase();
          const envVarName = PROVIDER_ENV_MAP[providerUpper] || `${providerUpper}_API_KEY`;
          effectiveApiKey = process.env[envVarName];
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
            userId: userId as Id<"users"> | undefined,
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
            userId: userId as Id<"users"> | undefined,
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
            userId: userId as Id<"users"> | undefined,
            convex,
            api,
            withRetry,
            log,
          });
        }
        break;
      }

      case "webSearch": {
        // Placeholder node: no AI call, so no usage or recordUsage. Real search runs inside RLM/tool flow.
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

    log("INFO", `Node ${nodeId} completed successfully`);
  } catch (error: unknown) {
    const isAbortError =
      error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    const errorMessage = error instanceof Error ? error.message : String(error);

    log("ERROR", `Node ${nodeId} failed`, { error: errorMessage });

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

    throw error;
  }
}

/**
 * Run resume continuation after user confirms a tool (human-in-the-loop).
 * Called by Inngest canvas/resume.task.
 */
export async function runResumeContinuation(data: ResumeContinuationPayload): Promise<void> {
  const convex = getConvexClient();
  const { canvasId, nodeId, toolResult, pendingToolCall, currentText, inputs, userId } = data;
  const modelId = inputs.modelId ?? "";
  const provider = (inputs.provider ?? "openai") as string;
  const modelDef = modelRegistry.getById(modelId);
  const effectiveProviderName = (modelDef?.provider || provider || "openai") as string;
  const providerUpper = effectiveProviderName.toUpperCase();
  const envVarName = PROVIDER_ENV_MAP[providerUpper] || `${providerUpper}_API_KEY`;
  const effectiveApiKey = process.env[envVarName];
  const targetModelId = modelDef?.providerModelId ?? resolveModelId(modelId) ?? modelId;

  await handleResumeContinuation({
    canvasId: canvasId as Id<"canvas">,
    nodeId,
    toolResult,
    pendingToolCall,
    currentText: currentText ?? "",
    effectiveProviderName,
    targetModelId,
    effectiveApiKey,
    userId: userId as Id<"users"> | undefined,
    convex,
    api,
    withRetry,
    log,
  });
}

import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import type { NodeExecutionInputs, NodeExecutionResult } from "../types";
import type { BaseAIService } from "@/lib/aiServices/base";

const DEFAULT_IMAGE_COST_USD = 0.02;

export interface ImageHandlerParams {
  canvasId: Id<"canvas">;
  nodeId: string;
  inputs: NodeExecutionInputs;
  service: BaseAIService;
  targetModel: string;
  userId?: Id<"users">;
  provider?: string;
  convex: { mutation: (fn: unknown, args: unknown) => Promise<unknown>; action: (fn: unknown, args: unknown) => Promise<unknown> };
  api: { canvas: { canvas: { updateNodeDataInternal: unknown } } };
  s3Client: S3Client;
  withRetry: <T>(fn: () => Promise<T>, name: string) => Promise<T>;
  log: (level: "INFO" | "WARN" | "ERROR", message: string, context?: Record<string, unknown>) => void;
}

export async function handleImageGeneration(params: ImageHandlerParams): Promise<NodeExecutionResult> {
  const {
    canvasId,
    nodeId,
    inputs,
    service,
    targetModel,
    userId,
    provider = "GPT",
    convex,
    api,
    s3Client,
    withRetry,
    log,
  } = params;

  const { prompt, text, imageSize, imageQuality, imageN, imageBackground } = inputs;

  log("INFO", `Generating image with model ${targetModel}`);

  await withRetry(
    () =>
      convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
        canvasId,
        nodeId,
        data: { status: "thinking" },
      }),
    "updateNodeDataInternal (image thinking)"
  );

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
    moderation: "auto",
  });

  let mediaStorageId = "";
  if (response.mediaUrl) {
    try {
      const imageRes = await fetch(response.mediaUrl);
      const arrayBuffer = await imageRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = imageRes.headers.get("content-type") || "image/png";
      const fileName = `${uuidv4()}.png`;
      const key = `generated/${fileName}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      mediaStorageId = key;
      log("INFO", `Uploaded generated image to S3: ${key}`);
    } catch (uploadError) {
      log("ERROR", "Failed to upload generated image to S3", { error: uploadError });
      throw new Error(
        `Failed to upload generated image to S3: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`
      );
    }
  }

  const markdownImage = `![Generated Image](${mediaStorageId ? "s3://" + mediaStorageId : response.mediaUrl})`;

  await withRetry(
    () =>
      convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
        canvasId,
        nodeId,
        data: {
          text: markdownImage,
          mediaUrl: null,
          mediaStorageId,
          status: "complete",
          type: "image",
        },
      }),
    "updateNodeDataInternal (image complete)"
  );

  const costUSD = Number(process.env.BILLING_IMAGE_COST_USD) || DEFAULT_IMAGE_COST_USD;
  if (userId) {
    const secret = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
    if (secret) {
      try {
        await convex.action(api.usage_actions.recordUsage, {
          secret,
          userId,
          modelId: targetModel,
          provider,
          category: "image",
          providerModelId: targetModel,
          tokens: 0,
          cost: costUSD,
        });
      } catch (err) {
        log("WARN", "Failed to record image usage", { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return {
    text: markdownImage,
    tokens: 0,
    cost: costUSD,
  };
}

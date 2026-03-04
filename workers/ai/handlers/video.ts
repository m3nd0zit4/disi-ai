import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import type { NodeExecutionInputs, NodeExecutionResult } from "../types";
import type { BaseAIService } from "@/lib/aiServices/base";

const DEFAULT_VIDEO_COST_USD = 0.10;

export interface VideoHandlerParams {
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

export async function handleVideoGeneration(params: VideoHandlerParams): Promise<NodeExecutionResult> {
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

  const { prompt, text, videoAspectRatio, videoResolution, videoDuration } = inputs;

  log("INFO", `Generating video with model ${targetModel}`);

  await withRetry(
    () =>
      convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
        canvasId,
        nodeId,
        data: { status: "thinking" },
      }),
    "updateNodeDataInternal (video thinking)"
  );

  const response = await (service as BaseAIService & {
    generateVideo(req: {
      model: string;
      prompt: string;
      aspectRatio?: string;
      resolution?: string;
      duration?: number;
      onProgress?: (progress: number) => Promise<void>;
    }): Promise<{ mediaUrl: string }>;
  }).generateVideo({
    model: targetModel,
    prompt: (prompt as string) || (text as string) || "",
    aspectRatio: videoAspectRatio as string | undefined,
    resolution: videoResolution as string | undefined,
    duration: videoDuration as number | undefined,
    onProgress: async (progress: number) => {
      await withRetry(
        () =>
          convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
            canvasId,
            nodeId,
            data: { progress },
          }),
        "updateNodeDataInternal (video progress)"
      );
    },
  });

  let mediaStorageId = "";
  if (response.mediaUrl) {
    try {
      let buffer: Buffer;
      let contentType = "video/mp4";

      if (response.mediaUrl.startsWith("data:")) {
        const parts = response.mediaUrl.split(",");
        const base64Data = parts[1];
        buffer = Buffer.from(base64Data, "base64");
        contentType = parts[0].split(";")[0].split(":")[1] || "video/mp4";
        log("INFO", `Processing base64 video data, size: ${buffer.length} bytes`);
      } else {
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
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      mediaStorageId = key;
      log("INFO", `Successfully uploaded generated video to S3: ${key}`);
    } catch (uploadError) {
      log("ERROR", "Failed to upload generated video to S3", { error: uploadError });
      throw new Error(
        `Failed to upload generated video to S3: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`
      );
    }
  }

  const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/file?key=${encodeURIComponent(mediaStorageId)}&redirect=true`;
  const markdownVideo = `### Generated Video\n\n[Download Video](${downloadUrl})`;

  await withRetry(
    () =>
      convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
        canvasId,
        nodeId,
        data: {
          text: markdownVideo,
          mediaUrl: null,
          mediaStorageId,
          status: "complete",
          type: "video",
          progress: 100,
        },
      }),
    "updateNodeDataInternal (video complete)"
  );

  const costUSD = Number(process.env.BILLING_VIDEO_COST_USD) || DEFAULT_VIDEO_COST_USD;
  if (userId) {
    const secret = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
    if (secret) {
      try {
        await convex.action(api.usage_actions.recordUsage, {
          secret,
          userId,
          modelId: targetModel,
          provider,
          category: "video",
          providerModelId: targetModel,
          tokens: 0,
          cost: costUSD,
        });
      } catch (err) {
        log("WARN", "Failed to record video usage", { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return {
    text: markdownVideo,
    tokens: 0,
    cost: costUSD,
  };
}

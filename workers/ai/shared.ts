import { SQSClient } from "@aws-sdk/client-sqs";
import { S3Client } from "@aws-sdk/client-s3";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export let isShuttingDown = false;

export function setIsShuttingDown(value: boolean) {
  isShuttingDown = value;
}

process.on("SIGTERM", () => {
  log("INFO", "Received SIGTERM, initiating graceful shutdown...");
  isShuttingDown = true;
});

process.on("SIGINT", () => {
  log("INFO", "Received SIGINT, initiating graceful shutdown...");
  isShuttingDown = true;
});

export const QUEUE_URLS = [
  process.env.SQS_QUEUE_URL_PRO!,
  process.env.SQS_QUEUE_URL_FREE!,
].filter(Boolean);

export function log(level: "INFO" | "WARN" | "ERROR", message: string, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
  console.log(`[${timestamp}] [${level}] ${message}${contextStr}`);
}

export async function withRetry<T>(
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
          `Retrying ${name} (${i + 1}/${retries}) due to network error: ${error instanceof Error ? error.message : String(error)}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/** Re-export Convex api for use in handlers */
export { api };

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Safe ConvexHttpClient initialization
let convexClient: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient | null {
  if (convexClient) return convexClient;
  
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.warn("[SQS] NEXT_PUBLIC_CONVEX_URL is not defined. Convex fallback unavailable.");
    return null;
  }
  
  convexClient = new ConvexHttpClient(convexUrl);
  return convexClient;
}

// Return type for queue operations
export interface QueueResult {
  messageId: string;
  queueType: 'sqs' | 'convex';
  error?: Error;
}

export interface SendToQueueOptions {
  allowFallback?: boolean;
}

export async function sendToQueue(
  queueUrl: string, 
  messageBody: { messageId: string; [key: string]: unknown }, 
  messageGroupId?: string,
  options: SendToQueueOptions = { allowFallback: true }
): Promise<QueueResult> {
  const useConvexQueue = process.env.USE_CONVEX_QUEUE === "true";

  if (!useConvexQueue) {
    try {
      const isFifo = queueUrl.endsWith(".fifo");
      
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(messageBody),
        ...(isFifo && {
          MessageGroupId: messageGroupId || "default",
          MessageDeduplicationId: `${messageBody.messageId}-${Date.now()}`,
        }),
      });

      const response = await sqsClient.send(command);
      console.log(`[SQS] Message sent to ${queueUrl}, ID: ${response.MessageId}`);
      
      return {
        messageId: response.MessageId!,
        queueType: 'sqs'
      };
    } catch (error) {
      console.error("[SQS] Error sending message:", error);
      
      // Emit metric for SQS failure
      console.warn(`[SQS] SQS failure detected. Fallback allowed: ${options.allowFallback}`);
      
      // If fallback is disabled, rethrow the error
      if (!options.allowFallback) {
        throw error;
      }
      
      // Otherwise, fall through to Convex fallback
    }
  }

  // Use Convex Queue Fallback
  console.log(`[WorkerQueue] Enqueuing task to Convex fallback for ${queueUrl}`);
  const convex = getConvexClient();
  
  if (!convex) {
    const error = new Error("Convex client unavailable and SQS failed");
    console.error("[WorkerQueue]", error.message);
    throw error;
  }
  
  try {
    const taskId = await convex.mutation(api.worker.enqueueTask, {
      queueUrl,
      messageBody: JSON.stringify(messageBody),
      messageGroupId,
    });
    
    return {
      messageId: taskId,
      queueType: 'convex'
    };
  } catch (convexError) {
    console.error("[WorkerQueue] Failed to enqueue to Convex fallback:", convexError);
    throw convexError;
  }
}

export { sqsClient };

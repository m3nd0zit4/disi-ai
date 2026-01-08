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

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function sendToQueue(queueUrl: string, messageBody: { messageId: string; [key: string]: unknown }, messageGroupId?: string) {
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
      return response;
    } catch (error) {
      console.error("[SQS] Error sending message, falling back to Convex queue:", error);
      // Fallback to Convex if SQS fails
    }
  }

  // Use Convex Queue Fallback
  console.log(`[WorkerQueue] Enqueuing task to Convex fallback for ${queueUrl}`);
  try {
    const taskId = await convex.mutation(api.worker.enqueueTask, {
      queueUrl,
      messageBody: JSON.stringify(messageBody),
      messageGroupId,
    });
    return { MessageId: taskId };
  } catch (convexError) {
    console.error("[WorkerQueue] Failed to enqueue to Convex fallback:", convexError);
    throw convexError;
  }
}

export { sqsClient };

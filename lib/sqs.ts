import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function sendToQueue(queueUrl: string, messageBody: { messageId: string; [key: string]: unknown }, messageGroupId?: string) {
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
    console.error("[SQS] Error sending message:", error);
    throw error;
  }
}

export { sqsClient };

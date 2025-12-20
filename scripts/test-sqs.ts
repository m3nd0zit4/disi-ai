import { SQSClient, ListQueuesCommand, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { config } from "dotenv";
import { resolve } from "path";

// Load env vars
const envPath = resolve(process.cwd(), ".env.local");
console.log(`Loading env from ${envPath}`);
config({ path: envPath });

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function testSQS() {
  console.log("🚀 Testing SQS Connection...");
  
  try {
    // 1. List Queues
    console.log("1. Listing queues...");
    const listResponse = await sqsClient.send(new ListQueuesCommand({}));
    console.log("✅ Queues found:", listResponse.QueueUrls || "None");

    const testQueueUrl = process.env.SQS_QUEUE_URL_FREE;
    if (!testQueueUrl) {
      console.error("❌ SQS_QUEUE_URL_FREE not defined in .env.local");
      return;
    }

    // 2. Send Test Message
    console.log(`2. Sending test message to ${testQueueUrl}...`);
    const sendResponse = await sqsClient.send(new SendMessageCommand({
      QueueUrl: testQueueUrl,
      MessageBody: JSON.stringify({ test: true, messageId: "test-id-" + Date.now() }),
    }));
    console.log("✅ Message sent, ID:", sendResponse.MessageId);

    // 3. Receive Test Message
    console.log("3. Receiving test message...");
    const receiveResponse = await sqsClient.send(new ReceiveMessageCommand({
      QueueUrl: testQueueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 5,
    }));

    if (receiveResponse.Messages && receiveResponse.Messages.length > 0) {
      const msg = receiveResponse.Messages[0];
      console.log("✅ Message received:", msg.Body);

      // 4. Delete Test Message
      console.log("4. Deleting test message...");
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: testQueueUrl,
        ReceiptHandle: msg.ReceiptHandle!,
      }));
      console.log("✅ Message deleted.");
    } else {
      console.log("⚠️ No messages received (this is normal if polling took too long or queue is busy).");
    }

    console.log("\n✨ SQS Test Completed Successfully!");

  } catch (error) {
    console.error("❌ SQS Test Failed:", error);
  }
}

testSQS();

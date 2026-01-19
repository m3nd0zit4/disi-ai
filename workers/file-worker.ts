import { config } from "dotenv";
import { resolve } from "path";

// 1. Load environment variables IMMEDIATELY before any other imports
config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  console.log("[File Worker] 🏁 Initializing services...");
  
  // 2. Dynamic imports to ensure env vars are available
  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("../convex/_generated/api");
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { extractTextFromS3 } = await import("../lib/textract");
  const { transcribeAudio } = await import("../lib/transcribe");
  const { generateEmbedding } = await import("../lib/bedrock");
  const { storeEmbedding } = await import("../lib/upstash-vector");
  const { Redis } = await import("@upstash/redis");

  const requiredEnv = [
    "NEXT_PUBLIC_CONVEX_URL",
    "CONVEX_DEPLOY_KEY",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_S3_BUCKET_NAME",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN"
  ];

  for (const env of requiredEnv) {
    if (!process.env[env]) {
      throw new Error(`Missing required environment variable: ${env}`);
    }
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  // Use admin authentication for internal updates
  (convex as any).setAdminAuth(process.env.CONVEX_DEPLOY_KEY!);
  const s3 = new S3Client({ 
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

  let isShuttingDown = false;

  process.on("SIGTERM", () => {
    console.log("[File Worker] 🛑 Received SIGTERM, initiating graceful shutdown...");
    isShuttingDown = true;
  });

  process.on("SIGINT", () => {
    console.log("[File Worker] 🛑 Received SIGINT, initiating graceful shutdown...");
    isShuttingDown = true;
  });

  console.log("[File Worker] ✅ Services initialized. Polling for files...");

  async function processFile(file: { _id: string; s3Key: string; fileName: string }) {
    const { _id: fileId, s3Key, fileName } = file;
    
    console.log(`[File Worker] 🚀 Processing file: ${fileName} (${fileId})`);
    
    try {
      // 1. Update status to 'processing'
      await convex.mutation(api.files.publicUpdateStatusByS3Key, {
        s3Key,
        status: "processing",
      });

      // 2. Determine file type and extract text
      let text = "";
      const extension = fileName.split('.').pop()?.toLowerCase();

      if (['pdf', 'png', 'jpg', 'jpeg'].includes(extension || '')) {
        text = await extractTextFromS3(BUCKET_NAME, s3Key);
      } else if (['mp3', 'mp4', 'wav', 'flac'].includes(extension || '')) {
        text = await transcribeAudio(BUCKET_NAME, s3Key);
      } else if (['txt', 'md', 'json', 'csv'].includes(extension || '')) {
        const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
        text = await response.Body?.transformToString() || "";
      } else {
        throw new Error(`Unsupported file type: ${extension}`);
      }

      if (!text) {
        throw new Error("No text extracted");
      }

      console.log(`[File Worker] ✅ Text extracted (${text.length} chars)`);

      // 3. Chunk text
      const chunks = semanticChunking(text);
      console.log(`[File Worker] 📦 Generated ${chunks.length} chunks`);

      // 4. Generate embeddings and store
      // Store full text in Redis
      await redis.set(`file:${fileId}:text`, text, { ex: 7 * 24 * 60 * 60 });

      // Process chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk);
        
        // Store in Vector DB
        await storeEmbedding(`${fileId}_${i}`, embedding, {
          text: chunk,
          fileId: fileId,
          chunkIndex: i,
          s3Key: s3Key
        });
        
        // Store in Redis List
        await redis.rpush(`file:${fileId}:chunks`, JSON.stringify({
          index: i,
          text: chunk,
          embedding: []
        }));
      }

      // 5. Update status to 'ready'
      await convex.mutation(api.files.publicUpdateStatusByS3Key, {
        s3Key,
        status: "ready",
        extractedTextLength: text.length,
        totalChunks: chunks.length,
      });

      console.log(`[File Worker] ✨ Successfully processed ${fileName}`);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[File Worker] ❌ Error processing ${fileName}:`, error);
      
      await convex.mutation(api.files.publicUpdateStatusByS3Key, {
        s3Key,
        status: "error",
        errorMessage,
      });
    }
  }

  while (!isShuttingDown) {
    try {
      const pendingFiles = await convex.query(api.files.publicGetPendingFiles);
      
      if (pendingFiles.length > 0) {
        console.log(`[File Worker] Found ${pendingFiles.length} pending files`);
        for (const file of pendingFiles) {
          if (isShuttingDown) break;
          await processFile(file);
        }
      }
    } catch (error) {
      console.error("[File Worker] Polling error:", error);
    }
    
    // Wait 5 seconds before next poll
    if (!isShuttingDown) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log("[File Worker] 👋 Shutdown complete");
}

function semanticChunking(text: string, maxTokens = 512, overlap = 50): string[] {
  // Clamp overlap to prevent infinite loops
  const safeOverlap = Math.min(overlap, maxTokens - 1);
  const maxChars = maxTokens * 4;
  const overlapChars = safeOverlap * 4;
  const chunks: string[] = [];
  
  let start = 0;
  while (start < text.length) {
    let end = start + maxChars;
    
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end);
      const lastPeriod = text.lastIndexOf('.', end);
      
      if (lastNewline > start + maxChars / 2) {
        end = lastNewline + 1;
      } else if (lastPeriod > start + maxChars / 2) {
        end = lastPeriod + 1;
      }
    }
    
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    // Ensure we always advance at least 1 character
    const nextStart = end - overlapChars;
    start = Math.max(nextStart, start + 1);
  }
  
  return chunks;
}

main().catch(err => {
  console.error("[File Worker] Fatal error:", err);
  process.exit(1);
});

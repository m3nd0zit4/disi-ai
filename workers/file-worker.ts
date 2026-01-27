import { config } from "dotenv";
import { resolve } from "path";

// 1. Load environment variables IMMEDIATELY before any other imports
config({ path: resolve(process.cwd(), ".env.local") });

console.log("[File Worker] 🚀 Starting file-worker.ts...");
console.log("[File Worker] Current directory:", process.cwd());
console.log("[File Worker] Environment loaded");

async function main() {
  console.log("[File Worker] 🏁 Initializing services...");
  
  // 2. Dynamic imports to ensure env vars are available
  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("../convex/_generated/api");
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { extractTextFromS3 } = await import("../lib/aws/textract");
  const { transcribeAudio } = await import("../lib/aws/transcribe");
  const { storeEmbedding } = await import("../lib/upstash/upstash-vector");
  const { Redis } = await import("@upstash/redis");

  const requiredEnv = [
    "NEXT_PUBLIC_CONVEX_URL",
    "CONVEX_DEPLOY_KEY",
    "FILE_WORKER_SECRET",
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
  // ConvexHttpClient.setAdminAuth is available but not in public types
  (convex as unknown as { setAdminAuth: (key: string) => void }).setAdminAuth(process.env.CONVEX_DEPLOY_KEY!);
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

    async function processFile(file: { _id: string; s3Key: string; fileName: string; kbId?: string }) {
    const { _id: fileId, s3Key, fileName, kbId } = file;
    
    console.log(`[File Worker] 🚀 Processing file: ${fileName} (${fileId})`);
    
    try {
      // 1. Update status to 'processing'
      await (convex as any).action(api.system.files.publicUpdateStatusByS3Key, {
        secret: process.env.FILE_WORKER_SECRET!,
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

      // Store full text in Redis for RAG context retrieval
      await redis.set(`file:${fileId}:text`, text, { ex: 60 * 60 * 24 * 7 }); // Expire in 7 days
      console.log(`[File Worker] ✅ Text extracted and stored in Redis (${text.length} chars)`);

      // 3. Chunk text
      console.log(`[File Worker] ✂️ Chunking text...`);
      let chunks: string[] = [];
      let isSmartSplit = true;

      if (kbId) {
        try {
          // Fetch KB to check settings
          const kb = await (convex as any).query(api.knowledge_garden.knowledgeBases.get, { id: kbId });
          if (kb) {
            isSmartSplit = kb.smartSplitEnabled ?? true;
            console.log(`[File Worker] ℹ️ KB Smart Split setting: ${isSmartSplit}`);
          }
        } catch (err) {
          console.error("[File Worker] ⚠️ Failed to fetch KB settings, defaulting to Smart Split", err);
        }
      }

      if (isSmartSplit) {
        chunks = semanticChunking(text);
      } else {
        chunks = simpleChunking(text);
      }
      
      console.log(`[File Worker] 📦 Generated ${chunks.length} chunks (Mode: ${isSmartSplit ? 'Smart' : 'Simple'})`);

      // 4. Generate embeddings and store Seeds
      const seeds: any[] = [];
      const { OpenAIService } = await import("../lib/aiServices/openai");
      const ai = new OpenAIService(process.env.OPENAI_API_KEY!);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await ai.generateEmbedding(chunk);

        // Create Seed in Convex if kbId is present
        let seedId = `${fileId}_${i}`; // Fallback ID if no KB
        let isDuplicate = false;

        if (kbId) {
          // Generate Metadata (Title/Summary) - simplified for now, ideally use LLM
          const title = `${fileName} - Part ${i + 1}`;
          const summary = chunk.substring(0, 100) + "...";

          // Check for duplicates (similarity > 0.95)
          const { searchSimilar } = await import("../lib/upstash/upstash-vector");
          const duplicateCandidates = await searchSimilar(embedding, 3, `kbId = '${kbId}'`);

          // Filter for high similarity (>0.95)
          const duplicates = duplicateCandidates.filter(d => d.score && d.score > 0.95);

          if (duplicates.length > 0) {
            console.log(`[File Worker] 🔍 Found ${duplicates.length} near-duplicate(s) for chunk ${i} (similarity > 0.95)`);
            isDuplicate = true;
            // Use existing seed ID instead of creating new one
            seedId = duplicates[0].id;
            console.log(`[File Worker] ⚠️ Skipping duplicate seed creation, using existing seed: ${seedId}`);
          } else {
            // Generate idempotency key to prevent duplicate seeds on worker retries
            const idempotencyKey = `${fileId}_chunk_${i}`;

            seedId = await (convex as any).action(api.knowledge_garden.seeds.workerCreateSeed, {
              secret: process.env.FILE_WORKER_SECRET!,
              kbId: kbId as any,
              fileId: fileId as any,
              title,
              summary,
              fullText: chunk,
              status: "ready",
              tags: [isSmartSplit ? "smart-split" : "quick-split"],
              idempotencyKey,
            });
            console.log(`[File Worker] ✅ Created new seed: ${seedId}`);
          }
        }

        // Store in Vector DB (convert seedId to string for consistency)
        const seedIdStr = String(seedId);
        await storeEmbedding(seedIdStr, embedding, {
          text: chunk,
          fileId: fileId,
          kbId: kbId,
          seedId: seedIdStr,
          chunkIndex: i,
          s3Key: s3Key,
          title: `${fileName} - Part ${i + 1}`
        });

        seeds.push({ id: seedIdStr, convexId: seedId, embedding, kbId });
      }

      // 5. Graph Linking (if KB)
      if (kbId && seeds.length > 0) {
        const { searchSimilar } = await import("../lib/upstash/upstash-vector");
        console.log(`[File Worker] 🔗 Linking ${seeds.length} seeds...`);

        for (const seed of seeds) {
          // Search for similar seeds in the same KB
          const neighbors = await searchSimilar(seed.embedding, 5, `kbId = '${kbId}'`);

          for (const neighbor of neighbors) {
            // Avoid self-linking (compare vector DB IDs as strings)
            if (neighbor.id === seed.id) {
              console.log(`[File Worker] Skipping self-link for seed: ${seed.id}`);
              continue;
            }

            // Extract Convex ID from neighbor metadata (stored during upsert)
            const neighborConvexId = neighbor.metadata?.seedId as string;
            if (!neighborConvexId) {
              console.warn(`[File Worker] Neighbor ${neighbor.id} missing seedId in metadata`);
              continue;
            }

            // Create link in Convex (workerCreateLink prevents duplicates and self-links)
            await (convex as any).action(api.knowledge_garden.seedLinks.workerCreateLink, {
              secret: process.env.FILE_WORKER_SECRET!,
              seedA: seed.convexId as any,
              seedB: neighborConvexId as any,
              relation: "RELATED",
              score: neighbor.score,
            });
          }
        }
      }

      // 6. Update status to 'ready'
      await (convex as any).action(api.system.files.publicUpdateStatusByS3Key, {
        secret: process.env.FILE_WORKER_SECRET!,
        s3Key,
        status: "ready",
        extractedTextLength: text.length,
        totalChunks: chunks.length,
      });

      console.log(`[File Worker] ✨ Successfully processed ${fileName}`);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[File Worker] ❌ Error processing ${fileName}:`, error);
      
      await (convex as any).action(api.system.files.publicUpdateStatusByS3Key, {
        secret: process.env.FILE_WORKER_SECRET!,
        s3Key,
        status: "error",
        errorMessage,
      });
    }
  }

  let pollCount = 0;
  while (!isShuttingDown) {
    try {
      pollCount++;
      const pendingFiles = await (convex as any).action(api.system.files.publicGetPendingFiles, {
        secret: process.env.FILE_WORKER_SECRET!
      });

      // Log every 12th poll (once per minute) to show we're alive
      if (pollCount % 12 === 0) {
        console.log(`[File Worker] Heartbeat: Poll #${pollCount}, pending files: ${pendingFiles.length}`);
      }

      if (pendingFiles.length > 0) {
        console.log(`[File Worker] Found ${pendingFiles.length} pending files to process`);
        for (const file of pendingFiles) {
          if (isShuttingDown) break;
          console.log(`[File Worker] Processing file: ${file.fileName} (id: ${file._id}, status: ${file.status}, kbId: ${file.kbId || "none"})`);
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

function simpleChunking(text: string, chunkSize = 1000, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  
  return chunks;
}

main().catch(err => {
  console.error("[File Worker] Fatal error:", err);
  process.exit(1);
});

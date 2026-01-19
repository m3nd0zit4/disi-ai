import { S3Event } from 'aws-lambda';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { extractTextFromS3 } from "../lib/textract";
import { transcribeAudio } from "../lib/transcribe";
import { generateEmbedding } from "../lib/bedrock";
import { storeEmbedding } from "../lib/upstash-vector";
import { Redis } from "@upstash/redis";

// Initialize clients
const requiredEnv = [
  'CONVEX_URL',
  'CONVEX_DEPLOY_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'UPSTASH_VECTOR_REST_URL',
  'UPSTASH_VECTOR_REST_TOKEN',
  'AWS_REGION'
];

for (const env of requiredEnv) {
  if (!process.env[env]) {
    throw new Error(`Missing required environment variable: ${env}`);
  }
}

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);
// Use admin authentication for internal updates
(convex as any).setAdminAuth(process.env.CONVEX_DEPLOY_KEY!);

const s3 = new S3Client({ region: process.env.AWS_REGION });
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function handler(event: S3Event) {
  console.log('Processing event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    try {
      console.log(`Processing file: ${key}`);

      // 1. Update status to 'processing'
      // We use 'any' cast because we are importing api from outside and types might be tricky in lambda build
      await convex.mutation((api.files as any).publicUpdateStatusByS3Key, {
        s3Key: key,
        status: "processing",
      });

      // 2. Determine file type and extract text
      let text = "";
      const extension = key.split('.').pop()?.toLowerCase();

      if (['pdf', 'png', 'jpg', 'jpeg'].includes(extension || '')) {
        text = await extractTextFromS3(bucket, key);
      } else if (['mp3', 'mp4', 'wav', 'flac'].includes(extension || '')) {
        text = await transcribeAudio(bucket, key);
      } else if (['txt', 'md', 'json', 'csv'].includes(extension || '')) {
        const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        text = await response.Body?.transformToString() || "";
      } else {
        console.log(`Unsupported file type: ${extension}`);
        await convex.mutation((api.files as any).publicUpdateStatusByS3Key, {
          s3Key: key,
          status: "error",
          errorMessage: `Unsupported file type: ${extension}`,
        });
        continue;
      }

      if (!text) {
        throw new Error("No text extracted");
      }

      // 3. Chunk text
      const chunks = semanticChunking(text);

      // 4. Generate embeddings and store
      const fileId = key.split('/').pop()?.split('.')[0] || 'unknown'; // This is the UUID from S3 key, not Convex ID. 
      // But we need to associate it with the file. 
      // We can use the S3 key as the ID for Redis/Vector or query Convex to get the real ID.
      // Let's get the real ID from Convex.
      const fileRecord = await convex.query((api.files as any).getFileByS3Key, { s3Key: key });
      const convexFileId = fileRecord?._id || fileId;

      console.log(`Generated ${chunks.length} chunks for file ${convexFileId}`);

      // Store full text in Redis
      await redis.set(`file:${convexFileId}:text`, text, { ex: 7 * 24 * 60 * 60 });

      // Process chunks in parallel batches
      const BATCH_SIZE = 10;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (chunk, j) => {
          const idx = i + j;
          const embedding = await generateEmbedding(chunk);
          
          // Store in Vector DB
          await storeEmbedding(`${convexFileId}_${idx}`, embedding, {
            text: chunk,
            fileId: convexFileId,
            chunkIndex: idx,
            s3Key: key
          });
          
          // Store in Redis List
          await redis.rpush(`file:${convexFileId}:chunks`, JSON.stringify({
            index: idx,
            text: chunk,
            embedding: [] // Don't store embedding in Redis list to save space
          }));
        }));
      }

      // 5. Update status to 'ready'
      await convex.mutation((api.files as any).publicUpdateStatusByS3Key, {
        s3Key: key,
        status: "ready",
        extractedTextLength: text.length,
        totalChunks: chunks.length,
      });

      // 6. Backup extracted text to S3
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: `extracted/${convexFileId}.txt`,
        Body: text,
      }));

      console.log(`Successfully processed ${key}`);

    } catch (error: unknown) {
      console.error(`Error processing ${key}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await convex.mutation((api.files as any).publicUpdateStatusByS3Key, {
        s3Key: key,
        status: "error",
        errorMessage,
      });
    }
  }
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
    
    // Try to break at a newline or period
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

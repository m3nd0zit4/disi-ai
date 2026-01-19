import { S3Event, Context } from 'aws-lambda';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { extractTextFromBuffer, extractTextFromS3 } from "../lib/textract";
import { transcribeAudio } from "../lib/transcribe";
import { generateEmbedding } from "../lib/bedrock";
import { storeEmbedding } from "../lib/upstash-vector";
import { Redis } from "@upstash/redis";

// Initialize clients
const convex = new ConvexHttpClient(process.env.CONVEX_URL!);
const s3 = new S3Client({ region: process.env.AWS_REGION });
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function handler(event: S3Event, context: Context) {
  console.log('Processing event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    try {
      console.log(`Processing file: ${key}`);

      // 1. Update status to 'processing'
      // We use 'any' cast because we are importing api from outside and types might be tricky in lambda build
      await convex.mutation((api.files as any).updateStatusByS3Key, {
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

      // Process chunks in batches
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk);
        
        // Store in Vector DB
        await storeEmbedding(`${convexFileId}_${i}`, embedding, {
          text: chunk,
          fileId: convexFileId,
          chunkIndex: i,
          s3Key: key
        });
        
        // Store in Redis List
        await redis.rpush(`file:${convexFileId}:chunks`, JSON.stringify({
          index: i,
          text: chunk,
          embedding: [] // Don't store embedding in Redis list to save space, it's in Vector DB
        }));
      }

      // 5. Update status to 'ready'
      await convex.mutation((api.files as any).updateStatusByS3Key, {
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

    } catch (error: any) {
      console.error(`Error processing ${key}:`, error);
      
      await convex.mutation((api.files as any).updateStatusByS3Key, {
        s3Key: key,
        status: "error",
        errorMessage: error.message || "Unknown error",
      });
    }
  }
}

function semanticChunking(text: string, maxTokens = 512, overlap = 50): string[] {
  // Simple character-based chunking for now (approx 4 chars per token)
  const maxChars = maxTokens * 4;
  const overlapChars = overlap * 4;
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
    
    start = end - overlapChars;
  }
  
  return chunks;
}

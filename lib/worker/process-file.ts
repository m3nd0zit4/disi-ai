import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/convex-client";
import { extractTextFromS3 } from "@/lib/aws/textract";
import { transcribeAudio } from "@/lib/aws/transcribe";
import { storeEmbedding, searchSimilar } from "@/lib/upstash/upstash-vector";
import { redis } from "@/lib/upstash/redis";
import { OpenAIService } from "@/lib/aiServices/openai";
import { extractTagsFromContent } from "@/lib/knowledge/evaluator";

export interface FileProcessPayload {
  fileId: string;
  s3Key: string;
  fileName: string;
  kbId?: string;
}

function semanticChunking(text: string, maxTokens = 512, overlap = 50): string[] {
  const safeOverlap = Math.min(overlap, maxTokens - 1);
  const maxChars = maxTokens * 4;
  const overlapChars = safeOverlap * 4;
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxChars;
    if (end < text.length) {
      const lastNewline = text.lastIndexOf("\n", end);
      const lastPeriod = text.lastIndexOf(".", end);
      if (lastNewline > start + maxChars / 2) {
        end = lastNewline + 1;
      } else if (lastPeriod > start + maxChars / 2) {
        end = lastPeriod + 1;
      }
    }
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
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

/** Extract topic-like tokens from file name (no extension) for coherent KB hashtags */
function tokensFromFileName(fileName: string): string[] {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  const tokens = base.split(/[\s_\-.,;:()+]+/).filter((t) => t.length >= 2);
  return [...new Set(tokens.map((t) => t.toLowerCase().slice(0, 30)))].slice(0, 5);
}

/** Build document tags from content + file name so KB hashtags are coherent with the document */
function buildDocumentTags(text: string, fileName: string, splitMode: "smart-split" | "quick-split"): string[] {
  const contentTags = extractTagsFromContent(text);
  const nameTokens = tokensFromFileName(fileName);
  const combined = [...contentTags, ...nameTokens];
  const unique = [...new Set(combined)].slice(0, 8);
  unique.push(splitMode);
  return unique;
}

/**
 * Process a single file: extract text, chunk, embed, create seeds and links.
 * Used by the Inngest file/process handler.
 */
export async function runFileProcess(payload: FileProcessPayload): Promise<void> {
  const { fileId, s3Key, fileName, kbId } = payload;
  const convex = getConvexClient();
  const secret = process.env.FILE_WORKER_SECRET;
  if (!secret) {
    throw new Error("FILE_WORKER_SECRET is not set");
  }

  const s3 = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
  if (!BUCKET_NAME) throw new Error("AWS_S3_BUCKET_NAME is not set");

  if (!redis) {
    throw new Error("Redis is not configured");
  }

  await convex.action(api.system.files.publicUpdateStatusByS3Key, {
    secret,
    s3Key,
    status: "processing",
  });

  let text = "";
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (["pdf", "png", "jpg", "jpeg"].includes(extension || "")) {
    text = await extractTextFromS3(BUCKET_NAME, s3Key);
  } else if (["mp3", "mp4", "wav", "flac"].includes(extension || "")) {
    text = await transcribeAudio(BUCKET_NAME, s3Key);
  } else if (["txt", "md", "json", "csv"].includes(extension || "")) {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key })
    );
    text = (await response.Body?.transformToString()) || "";
  } else {
    throw new Error(`Unsupported file type: ${extension}`);
  }

  if (!text) throw new Error("No text extracted");

  await redis.set(`file:${fileId}:text`, text, { ex: 60 * 60 * 24 * 7 });

  let isSmartSplit = true;
  if (kbId) {
    try {
      const kb = await convex.query(api.knowledge_garden.knowledgeBases.get, {
        id: kbId as Id<"knowledgeBases">,
      });
      if (kb) isSmartSplit = (kb as { smartSplitEnabled?: boolean }).smartSplitEnabled ?? true;
    } catch {
      // default to smart split
    }
  }

  const chunks = isSmartSplit ? semanticChunking(text) : simpleChunking(text);
  const splitMode = isSmartSplit ? "smart-split" : "quick-split";
  const documentTags = buildDocumentTags(text, fileName, splitMode);

  const ai = new OpenAIService(process.env.OPENAI_API_KEY!);
  const seeds: { id: string; convexId: string; embedding: number[]; kbId?: string }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await ai.generateEmbedding(chunk);
    let seedId: string = `${fileId}_${i}`;
    let isDuplicate = false;

    if (kbId) {
      const title = `${fileName} - Part ${i + 1}`;
      const summary = chunk.substring(0, 100) + "...";
      const duplicateCandidates = await searchSimilar(embedding, 3, `kbId = '${kbId}'`);
      const duplicates = duplicateCandidates.filter((d) => d.score && d.score > 0.95);
      if (duplicates.length > 0) {
        isDuplicate = true;
        seedId = duplicates[0].id;
      } else {
        const idempotencyKey = `${fileId}_chunk_${i}`;
        seedId = await convex.action(api.knowledge_garden.seeds.workerCreateSeed, {
          secret,
          kbId: kbId as Id<"knowledgeBases">,
          fileId: fileId as Id<"files">,
          title,
          summary,
          fullText: chunk,
          status: "ready",
          tags: documentTags,
          idempotencyKey,
        });
      }
    }

    const seedIdStr = String(seedId);
    await storeEmbedding(seedIdStr, embedding, {
      text: chunk,
      fileId,
      kbId,
      seedId: seedIdStr,
      chunkIndex: i,
      s3Key,
      title: `${fileName} - Part ${i + 1}`,
    });
    seeds.push({
      id: seedIdStr,
      convexId: seedId,
      embedding,
      kbId,
    });
  }

  if (kbId && seeds.length > 0) {
    for (const seed of seeds) {
      const neighbors = await searchSimilar(seed.embedding, 5, `kbId = '${kbId}'`);
      for (const neighbor of neighbors) {
        if (neighbor.id === seed.id) continue;
        const neighborConvexId = neighbor.metadata?.seedId as string;
        if (!neighborConvexId) continue;
        await convex.action(api.knowledge_garden.seedLinks.workerCreateLink, {
          secret,
          seedA: seed.convexId as Id<"seeds">,
          seedB: neighborConvexId as Id<"seeds">,
          relation: "RELATED",
          score: neighbor.score ?? 0,
        });
      }
    }
  }

  await convex.action(api.system.files.publicUpdateStatusByS3Key, {
    secret,
    s3Key,
    status: "ready",
    extractedTextLength: text.length,
    totalChunks: chunks.length,
  });
}

export async function runFileProcessWithErrorHandling(payload: FileProcessPayload): Promise<void> {
  const { s3Key } = payload;
  const convex = getConvexClient();
  const secret = process.env.FILE_WORKER_SECRET;
  if (!secret) {
    throw new Error("FILE_WORKER_SECRET is not set");
  }
  try {
    await runFileProcess(payload);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await convex.action(api.system.files.publicUpdateStatusByS3Key, {
      secret,
      s3Key,
      status: "error",
      errorMessage,
    });
    throw error;
  }
}

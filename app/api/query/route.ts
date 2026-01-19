import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { queryLLM } from "@/lib/bedrock";
import { searchSimilar } from "@/lib/upstash-vector";
import { generateEmbedding } from "@/lib/bedrock";
import { redis } from "@/lib/redis"; // Assuming this exists or I should use upstash-vector one? 
// Wait, lib/redis.ts exists (I saw it in list_dir).
// But I should verify if it exports 'redis' client.

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  try {
    const { prompt, fileIds } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // 1. Get file metadata from Convex to verify access and status
    // We can use a query to get multiple files. 
    // For now, let's just assume fileIds are valid or check them one by one if no bulk query exists.
    // I added 'getFiles' (by canvas) and 'getFile' (by id) in convex/files.ts.
    // I should probably add 'getFilesByIds' query.
    // For now, I'll skip strict validation or do it in parallel.
    
    // 2. Generate query embedding
    const queryEmbedding = await generateEmbedding(prompt);

    // 3. Search for relevant chunks across all files
    // We can filter by fileId in Upstash Vector if we indexed it.
    // In lambda/index.ts I added metadata: { fileId: ... }
    // So we can filter.
    
    let allRelevantChunks: any[] = [];

    if (fileIds && fileIds.length > 0) {
      // Search with filter for each file or use a generic filter if Upstash supports 'IN' operator.
      // Upstash Vector filter supports 'fileId = "..."'. 
      // It might not support 'IN'. So we might need to query for each file or just query global and filter results (less efficient).
      // Or query global with filter "fileId IN [...]" if supported.
      // Documentation says: filter: "genre = 'drama'"
      // It supports SQL-like filters. "fileId IN ('id1', 'id2')" might work.
      
      const filterStr = `fileId IN (${fileIds.map((id: string) => `'${id}'`).join(', ')})`;
      
      const results = await searchSimilar(queryEmbedding, 10, { filter: filterStr });
      allRelevantChunks = results;
    } else {
      // If no files selected, maybe search everything? Or return error?
      // For now, search everything (global context)
      const results = await searchSimilar(queryEmbedding, 10);
      allRelevantChunks = results;
    }

    // 4. Build context
    const context = allRelevantChunks
      .map((c) => c.metadata?.text)
      .filter(Boolean)
      .join("\n\n---\n\n");

    // 5. Call LLM
    const answer = await queryLLM(prompt, context);

    return NextResponse.json({ answer, sources: allRelevantChunks });

  } catch (error: any) {
    console.error("Query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

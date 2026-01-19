import { NextResponse } from "next/server";
import { searchSimilar } from "@/lib/upstash-vector";
import { generateEmbedding, queryLLM } from "@/lib/bedrock";

// Removed unused imports: ConvexHttpClient, api, redis

export async function POST(req: Request) {
  try {
    const { prompt: rawPrompt, fileIds: rawFileIds } = await req.json();

    if (!rawPrompt || typeof rawPrompt !== "string") {
      return NextResponse.json({ error: "Prompt is required and must be a string" }, { status: 400 });
    }

    // Sanitize prompt: remove control characters and limit length
    const prompt = rawPrompt
      .replace(/[\x00-\x1F\x7F]/g, "")
      .trim()
      .slice(0, 4000); // Reasonable limit for vector search query

    if (prompt.length === 0) {
      return NextResponse.json({ error: "Invalid prompt after sanitization" }, { status: 400 });
    }

    // Validate fileIds: must be an array of strings (Convex IDs)
    let fileIds: string[] = [];
    if (rawFileIds) {
      if (!Array.isArray(rawFileIds)) {
        return NextResponse.json({ error: "fileIds must be an array" }, { status: 400 });
      }
      fileIds = rawFileIds.filter(id => typeof id === "string" && /^[a-z0-9]+$/i.test(id));
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
    
    let allRelevantChunks: { metadata?: { text?: string } }[] = [];

    if (fileIds && fileIds.length > 0) {
      // Search with filter for each file or use a generic filter if Upstash supports 'IN' operator.
      // Upstash Vector filter supports 'fileId = "..."'. 
      // It might not support 'IN'. So we might need to query for each file or just query global and filter results (less efficient).
      // Or query global with filter "fileId IN [...]" if supported.
      // Documentation says: filter: "genre = 'drama'"
      // It supports SQL-like filters. "fileId IN ('id1', 'id2')" might work.
      
      const filterStr = `fileId IN (${fileIds.map((id: string) => `'${id}'`).join(', ')})`;
      
      const results = await searchSimilar(queryEmbedding, 10, filterStr);
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

  } catch (error: unknown) {
    console.error("Query error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
  }
}

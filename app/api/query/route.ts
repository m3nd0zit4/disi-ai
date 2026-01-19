import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { searchSimilar } from "@/lib/upstash-vector";
import { generateEmbedding, queryLLM } from "@/lib/bedrock";

export async function POST(req: Request) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt: rawPrompt, fileIds: rawFileIds } = await req.json();

    if (!rawPrompt || typeof rawPrompt !== "string") {
      return NextResponse.json({ error: "Prompt is required and must be a string" }, { status: 400 });
    }

    // Sanitize prompt: remove control characters and limit length
    // Using Unicode property escape for control characters (ES2018+)
    const prompt = rawPrompt
      .replace(/\p{Cc}/gu, "")
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
      
      const potentialFileIds = rawFileIds.filter(id => typeof id === "string" && /^[a-z0-9]+$/i.test(id));
      
      if (potentialFileIds.length > 0) {
        // Verify ownership via Convex
        const token = await getToken({ template: "convex" });
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        if (token) convex.setAuth(token);
        
        const validatedFiles = await convex.query(api.files.getFilesByIds, { 
          fileIds: potentialFileIds as any[] 
        });
        
        fileIds = validatedFiles.map(f => f._id);
        
        if (fileIds.length === 0) {
          return NextResponse.json({ 
            error: "None of the provided file IDs are valid or owned by you" 
          }, { status: 400 });
        }
      }
    }
    
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

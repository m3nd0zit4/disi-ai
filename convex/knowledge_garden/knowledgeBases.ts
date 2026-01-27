import { v } from "convex/values";
import { mutation, query, action } from "../_generated/server";
import { OpenAIService } from "../../lib/aiServices/openai";
import { searchSimilar } from "../../lib/upstash/upstash-vector";
import { api } from "../_generated/api";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const kbs = await ctx.db
      .query("knowledgeBases")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return kbs;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    smartSplitEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const kbId = await ctx.db.insert("knowledgeBases", {
      userId: user._id,
      name: args.name,
      description: args.description,
      smartSplitEnabled: args.smartSplitEnabled ?? true,
      fileCount: 0,
      seedCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return kbId;
  },
});

export const update = mutation({
  args: {
    id: v.id("knowledgeBases"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    smartSplitEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const kb = await ctx.db.get(args.id);
    if (!kb) {
      throw new Error("Knowledge Base not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || kb.userId !== user._id) {
      throw new Error("Unauthorized access to KB");
    }

    await ctx.db.patch(args.id, {
      ...(args.name && { name: args.name }),
      ...(args.description && { description: args.description }),
      ...(args.smartSplitEnabled !== undefined && { smartSplitEnabled: args.smartSplitEnabled }),
      updatedAt: Date.now(),
    });
  },
});

export const deleteKb = action({
  args: { id: v.id("knowledgeBases") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const kb = await ctx.runQuery(api.knowledge_garden.knowledgeBases.get, { id: args.id });
    if (!kb) throw new Error("KB not found");

    const user = await ctx.runQuery(api.users.users.getUserByClerkId, { clerkId: identity.subject });
    if (!user || kb.userId !== user._id) throw new Error("Unauthorized");

    console.log(`[KnowledgeBases] Starting cascade delete for KB ${args.id}`);

    // 1. Get all seeds and delete them (which will delete seedLinks)
    const seeds = await ctx.runQuery(api.knowledge_garden.seeds.listByKb, { kbId: args.id });
    console.log(`[KnowledgeBases] Deleting ${seeds.length} seeds...`);

    const { deleteEmbedding } = await import("../../lib/upstash/upstash-vector");

    for (const seed of seeds) {
      // Delete from vector DB
      try {
        await deleteEmbedding(String(seed._id));
        console.log(`[KnowledgeBases] Deleted embedding for seed ${seed._id}`);
      } catch (error) {
        console.warn(`[KnowledgeBases] Failed to delete embedding for seed ${seed._id}:`, error);
      }

      // Delete seed (includes seedLinks via deleteSeed internal mutation)
      await ctx.runMutation(api.knowledge_garden.seeds.deleteSeed, { seedId: seed._id });
    }

    // 2. Get all files and delete them
    const files = await ctx.runQuery(api.system.files.listByKb, { kbId: args.id });
    console.log(`[KnowledgeBases] Deleting ${files.length} files...`);

    for (const file of files) {
      await ctx.runMutation(api.system.files.deleteFile, { fileId: file._id });
    }

    // 3. Delete the KB record
    await ctx.runMutation(api.knowledge_garden.knowledgeBases.deleteKbInternal, { id: args.id });

    console.log(`[KnowledgeBases] Successfully deleted KB ${args.id} with cascade`);
  },
});

export const deleteKbInternal = mutation({
  args: { id: v.id("knowledgeBases") },
  handler: async (ctx, args) => {
    // Internal mutation called by deleteKb action after cleanup
    await ctx.db.delete(args.id);
  },
});

export const get = query({
  args: { id: v.id("knowledgeBases") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const kb = await ctx.db.get(args.id);
    if (!kb) {
      // Return null instead of throwing - KB may have been deleted
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || kb.userId !== user._id) {
       if (!kb.isPublic) {
         // Return null for unauthorized access instead of throwing
         return null;
       }
    }

    return kb;
  },
});

export const queryAction = action({
  args: {
    kbId: v.id("knowledgeBases"),
    query: v.string(),
    topK: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) throw new Error("System OpenAI key not configured");

    const ai = new OpenAIService(openaiKey);

    // 1. Generate Embedding
    const embedding = await ai.generateEmbedding(args.query);

    // 2. Search Vector DB
    const results = await searchSimilar(embedding, args.topK || 5, `kbId = '${args.kbId}'`);

    if (results.length === 0) {
      return {
        answer: "I couldn't find any relevant information in this knowledge base.",
        sources: []
      };
    }

    // 3. Fetch Seed Details
    const seeds = await Promise.all(
      results.map(async (res) => {
        const seed = await ctx.runQuery(api.knowledge_garden.seeds.getDetail, { 
          seedId: res.id as Id<"seeds"> 
        });
        return seed;
      })
    );

    const validSeeds: Doc<"seeds">[] = seeds.filter((s): s is Doc<"seeds"> => s !== null);

    // 4. Generate Answer
    const context = validSeeds.map(s => `[Source: ${s.title}]\n${s.summary || s.fullText}`).join("\n\n");
    
    const prompt = `You are a helpful assistant answering questions based on a Knowledge Base.
Use the following context to answer the user's question. If the context doesn't contain the answer, say you don't know.

CONTEXT:
${context}

USER QUESTION:
${args.query}

ANSWER:`;

    const response = await ai.generateResponse({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1000,
    });

    return {
      answer: response.content,
      sources: validSeeds.map(s => ({ id: s._id, title: s.title }))
    };
  },
});

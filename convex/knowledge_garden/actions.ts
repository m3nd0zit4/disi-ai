import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const extractUrlContent = action({
  args: {
    url: v.string(),
    kbId: v.id("knowledgeBases"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    try {
      const response = await fetch(args.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Basic HTML to Text extraction (simplified)
      // In a real app, use a library like cheerio or a dedicated service
      const text = html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "") // Remove scripts
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "") // Remove styles
        .replace(/<[^>]+>/g, " ") // Remove tags
        .replace(/\s+/g, " ") // Collapse whitespace
        .trim();

      const titleMatch = html.match(/<title>(.*?)<\/title>/);
      const title = titleMatch ? titleMatch[1] : args.url;

      // Check KB settings for Smart Split
      const kb = await ctx.runQuery(api.knowledge_garden.knowledgeBases.get, { id: args.kbId });
      const isSmartSplit = kb?.smartSplitEnabled ?? true;

      // Simulate splitting logic (in a real app, this would be more complex)
      // For now, we just add a tag indicating the split mode
      const splitTag = isSmartSplit ? "smart-split" : "quick-split";

      // Create the seed via mutation
      await ctx.runMutation(api.knowledge_garden.seeds.create, {
        kbId: args.kbId,
        title: title.substring(0, 100), // Limit title length
        fullText: text,
        summary: text.substring(0, 200) + "...",
        status: "ready",
        tags: ["web-link", splitTag],
      });

      return { success: true };
    } catch (error: unknown) {
      console.error("URL extraction failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`URL extraction failed: ${errorMessage}`);
    }
  },
});

export const generateTags = action({
  args: {
    text: v.string(),
  },
  handler: async (_ctx, _args) => {
    // Mock implementation for now
    // In a real app, call an LLM here
    const keywords = ["technology", "ai", "innovation", "future", "data"];
    return keywords.filter(() => Math.random() > 0.5);
  },
});

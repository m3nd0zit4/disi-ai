import { convexTest } from "convex-test";
import { api } from "../_generated/api";
import schema from "../schema";
import { describe, test, expect } from "vitest";

describe("Knowledge Garden Integration", () => {
  test("Full Flow: Create KB -> Create Seed -> Promote to Canvas", async () => {
    const t = convexTest(schema);
    
    // 1. Setup User
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test_user",
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        plan: "free",
        apiKeySource: "system"
      });
    });
    
    // Mock Auth
    t.withIdentity({ subject: "test_user" });

    // 2. Create Knowledge Base
    const kbId = await t.mutation(api.knowledge_garden.knowledgeBases.create, {
      name: "Test KB",
      description: "Integration Test KB",
    });
    expect(kbId).toBeDefined();

    // 3. Create Seed
    const seedId = await t.mutation(api.knowledge_garden.seeds.create, {
      kbId,
      title: "Test Seed",
      summary: "This is a test seed.",
      fullText: "Full text content here.",
      status: "ready",
    });
    expect(seedId).toBeDefined();

    // 4. Create Canvas
    const canvasId = await t.mutation(api.canvas.canvas.createCanvas, {
      name: "Test Canvas",
    });
    expect(canvasId).toBeDefined();

    // 5. Promote Seed to Canvas
    const result = await t.mutation(api.canvas.canvas.promoteSeedToCanvas, {
      canvasId,
      seedId,
    });
    expect(result.success).toBe(true);

    // 6. Verify Canvas Node
    const canvas = await t.query(api.canvas.canvas.getCanvas, { canvasId });
    expect(canvas?.nodes.length).toBe(1);
    expect(canvas?.nodes[0].data.seedId).toBe(seedId);
  });
});

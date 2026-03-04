import { Id } from "@/convex/_generated/dataModel";
import { evaluateForKnowledge, shouldEvaluate } from "@/lib/knowledge/evaluator";
import { searchSimilar, storeEmbedding, generateEmbedding } from "@/lib/upstash/upstash-vector";

export interface ProcessKnowledgeGardenFeedParams {
  executionId: Id<"canvasExecutions">;
  canvasId: Id<"canvas">;
  nodeId: string;
  content: string;
}

export interface KgFeedContext {
  convex: {
    query: (fn: unknown, args: unknown) => Promise<unknown>;
    action: (fn: unknown, args: unknown) => Promise<unknown>;
  };
  api: {
    canvas: { canvasExecutions: { get: unknown } };
    users: { settings_actions: { workerGetGardenSettings: unknown } };
    knowledge_garden: { seedCandidates: { workerAutoCreateSeed: unknown; workerCreateCandidate: unknown } };
  };
  log: (level: "INFO" | "WARN" | "ERROR", message: string, context?: Record<string, unknown>) => void;
}

/**
 * Process Knowledge Garden auto-feed for AI responses.
 * Runs asynchronously and doesn't block the main worker flow.
 */
export async function processKnowledgeGardenFeed(
  params: ProcessKnowledgeGardenFeedParams,
  ctx: KgFeedContext
): Promise<void> {
  const { executionId, canvasId, nodeId, content } = params;
  const { convex, api, log } = ctx;

  if (!shouldEvaluate(content, 50)) {
    log("INFO", "KG: Content too short, skipping evaluation");
    return;
  }

  try {
    const execution = await convex.query(api.canvas.canvasExecutions.get, {
      executionId,
    }) as { userId: Id<"users"> } | null;

    if (!execution) {
      log("WARN", "KG: Execution not found, skipping");
      return;
    }

    const userId = execution.userId;

    const settings = await convex.action(api.users.settings_actions.workerGetGardenSettings, {
      secret: process.env.FILE_WORKER_SECRET!,
      userId,
    }) as {
      isActive: boolean;
      feedMode: string;
      defaultKbId?: Id<"knowledgeBases">;
      autoThreshold: number;
      suggestThreshold: number;
      duplicateThreshold: number;
    };

    if (!settings.isActive || settings.feedMode === "manual") {
      log("INFO", "KG: Garden inactive or manual mode for user, skipping");
      return;
    }

    const evaluation = evaluateForKnowledge(content);
    log("INFO", `KG: Evaluation score ${evaluation.score.toFixed(2)}`, {
      reasons: evaluation.reasons.slice(0, 3),
    });

    const threshold =
      settings.feedMode === "automatic" ? settings.autoThreshold : settings.suggestThreshold;

    if (evaluation.score < threshold) {
      log("INFO", `KG: Score ${evaluation.score.toFixed(2)} below threshold ${threshold}, skipping`);
      return;
    }

    let similarSeedId: Id<"seeds"> | undefined;
    let similarityScore: number | undefined;
    let isDuplicate = false;

    try {
      const embedding = await generateEmbedding(content.slice(0, 8000));

      const filter = settings.defaultKbId
        ? `kbId = '${settings.defaultKbId}'`
        : undefined;

      const similar = await searchSimilar(embedding, 1, filter);

      if (similar.length > 0 && similar[0].score >= settings.duplicateThreshold) {
        log("INFO", `KG: Duplicate found (similarity ${similar[0].score.toFixed(3)}), skipping`);
        isDuplicate = true;
        return;
      }

      if (similar.length > 0 && similar[0].score >= 0.8) {
        similarSeedId = similar[0].id as Id<"seeds">;
        similarityScore = similar[0].score;
        log("INFO", `KG: Similar seed found (${similar[0].score.toFixed(3)}), will create RELATED link`);
      }
    } catch (embedError) {
      log("WARN", "KG: Duplicate check failed, continuing", {
        error: embedError instanceof Error ? embedError.message : String(embedError),
      });
    }

    const secret = process.env.FILE_WORKER_SECRET;
    if (!secret) {
      log("ERROR", "KG: FILE_WORKER_SECRET not configured");
      return;
    }

    const candidateData = {
      secret,
      userId,
      kbId: settings.defaultKbId,
      canvasId,
      nodeId,
      executionId,
      title: evaluation.suggestedTitle,
      content,
      summary: content.slice(0, 500) + (content.length > 500 ? "..." : ""),
      evaluationScore: evaluation.score,
      evaluationReasons: evaluation.reasons,
      evaluationMetrics: {
        wordCount: evaluation.metrics.wordCount,
        sentenceCount: evaluation.metrics.sentenceCount,
        hasStructure: evaluation.metrics.hasStructure,
        hasCodeBlocks: evaluation.metrics.hasCodeBlocks,
        informationDensity: evaluation.metrics.informationDensity,
      },
      similarSeedId,
      similarityScore,
      status:
        settings.feedMode === "automatic" && settings.defaultKbId
          ? ("auto_approved" as const)
          : ("pending" as const),
      feedMode: settings.feedMode,
    };

    if (settings.feedMode === "automatic" && settings.defaultKbId) {
      const titleHash = evaluation.suggestedTitle.slice(0, 32).replace(/[^a-zA-Z0-9]/g, "");
      const idempotencyKey = `auto-${executionId}-${nodeId}-${titleHash}`;

      const seedId = await convex.action(api.knowledge_garden.seedCandidates.workerAutoCreateSeed, {
        secret,
        userId,
        kbId: settings.defaultKbId,
        canvasId,
        nodeId,
        executionId,
        title: evaluation.suggestedTitle,
        content,
        summary: content.slice(0, 500),
        tags: evaluation.suggestedTags,
        idempotencyKey,
      }) as Id<"seeds">;

      try {
        const embedding = await generateEmbedding(content.slice(0, 8000));
        await storeEmbedding(String(seedId), embedding, {
          kbId: String(settings.defaultKbId),
          title: evaluation.suggestedTitle,
          type: "seed",
          source: "auto-feed",
        });
        log("INFO", `KG: Auto-created seed ${seedId} with embedding`);
      } catch (embedError) {
        log("WARN", `KG: Created seed ${seedId} but embedding failed`, {
          error: embedError instanceof Error ? embedError.message : String(embedError),
        });
      }
    } else {
      await convex.action(api.knowledge_garden.seedCandidates.workerCreateCandidate, candidateData);
      log("INFO", "KG: Created candidate for assisted review");
    }
  } catch (error) {
    log("ERROR", "KG: Auto-feed processing failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

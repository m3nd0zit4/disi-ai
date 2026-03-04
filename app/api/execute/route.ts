// Main API route for node execution
import { auth } from "@clerk/nextjs/server";
import { sendToQueue } from "@/lib/aws/sqs";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getConvexClient } from "@/lib/convex-client";
import { inngest } from "@/lib/inngest/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { modelRegistry } from "@/shared/ai";
import type { KbRef, KbContextItem } from "@/types/kb-refs";
import { findBestPosition } from "@/lib/canvas/layout";
import { getRegisteredToolNames } from "@/lib/agent/tools/registry";
import { NodeData, DisplayNodeData, ResponseNodeData } from "@/app/_components/canvas/types";

type CanvasNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: NodeData;
};

type CanvasEdge = {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
};

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

type ConvexClient = ReturnType<typeof getConvexClient>;

/** Resolve kbRefs (or legacy kbIds) to a unified kbContext array for the worker */
async function resolveKbContext(
  convex: ConvexClient,
  body: { kbRefs?: KbRef[]; kbIds?: string[] },
  userId: Id<"users">,
  queryText: string
): Promise<KbContextItem[]> {
  const kbRefs = Array.isArray(body.kbRefs) ? body.kbRefs : [];
  const kbIds = Array.isArray(body.kbIds) ? body.kbIds : [];

  if (kbRefs.length > 0) {
    const seen = new Set<string>();
    const out: KbContextItem[] = [];

    for (const ref of kbRefs) {
      if (ref.type === "kb") {
        const kb = await convex.query(api.knowledge_garden.knowledgeBases.get, { id: ref.kbId as Id<"knowledgeBases"> });
        if (!kb || kb.userId !== userId) continue;
        if (!queryText.trim()) continue;
        const searchResults = await convex.query(api.knowledge_garden.seeds.search, {
          query: queryText,
          kbIds: [ref.kbId as Id<"knowledgeBases">],
          limit: 5,
        });
        for (const seed of searchResults) {
          const id = String(seed._id);
          if (seen.has(id)) continue;
          seen.add(id);
          out.push({
            id,
            title: seed.title,
            content: seed.fullText || seed.summary || "",
            kbId: seed.kbId,
            score: 1,
          });
        }
      } else if (ref.type === "seed" && ref.seedIds?.length) {
        const seeds = await convex.query(api.knowledge_garden.seeds.getMany, {
          seedIds: ref.seedIds as Id<"seeds">[],
        });
        for (const seed of seeds) {
          if (seed.kbId !== ref.kbId) continue;
          const id = String(seed._id);
          if (seen.has(id)) continue;
          seen.add(id);
          out.push({
            id,
            title: seed.title,
            content: seed.fullText || seed.summary || "",
            kbId: seed.kbId,
          });
        }
      } else if (ref.type === "tag" && ref.tags?.length) {
        const seeds = await convex.query(api.knowledge_garden.seeds.listByKbAndTags, {
          kbId: ref.kbId as Id<"knowledgeBases">,
          tags: ref.tags,
        });
        for (const seed of seeds) {
          const id = String(seed._id);
          if (seen.has(id)) continue;
          seen.add(id);
          out.push({
            id,
            title: seed.title,
            content: seed.fullText || seed.summary || "",
            kbId: seed.kbId,
          });
        }
      } else if (ref.type === "file" && ref.fileIds?.length) {
        for (const fileId of ref.fileIds) {
          const seeds = await convex.query(api.knowledge_garden.seeds.listByFile, {
            fileId: fileId as Id<"files">,
          });
          for (const seed of seeds) {
            if (seed.kbId !== ref.kbId) continue;
            const id = String(seed._id);
            if (seen.has(id)) continue;
            seen.add(id);
            out.push({
              id,
              title: seed.title,
              content: seed.fullText || seed.summary || "",
              kbId: seed.kbId,
            });
          }
        }
      }
    }

    if (out.length > 0) console.log(`[Execute] Resolved ${out.length} KB context items from kbRefs`);
    return out;
  }

  // Legacy: kbIds only
  if (kbIds.length === 0 || !queryText.trim()) return [];

  const validatedKbIds: Id<"knowledgeBases">[] = [];
  for (const kbId of kbIds) {
    try {
      const kb = await convex.query(api.knowledge_garden.knowledgeBases.get, { id: kbId as Id<"knowledgeBases"> });
      if (kb && kb.userId === userId) validatedKbIds.push(kbId as Id<"knowledgeBases">);
    } catch {
      // skip
    }
  }
  if (validatedKbIds.length === 0) return [];

  const searchResults = await convex.query(api.knowledge_garden.seeds.search, {
    query: queryText,
    kbIds: validatedKbIds,
    limit: 5,
  });
  return searchResults.map((seed) => ({
    id: String(seed._id),
    title: seed.title,
    content: seed.fullText || seed.summary || "",
    kbId: seed.kbId,
    score: 1,
  }));
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId, getToken } = await auth();
    
    if (!clerkId) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }
    const rl = await checkRateLimit(clerkId, "execute");
    if (!rl.success) {
      return apiError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
    }

    console.log(`[Execute] Authenticating for user ${clerkId}`);
    const token = await getToken({ template: "convex" });
    if (!token) {
      console.error(`[Execute] Missing Convex auth token for template 'convex'`);
      return apiError("Convex auth token missing", 401, "AUTH_TOKEN_MISSING");
    }
    const convex = getConvexClient(token);

    // Default model configuration
    const DEFAULT_MODEL = {
      category: "reasoning" as const,
      modelId: "gpt-5.2",
      provider: "GPT",
      providerModelId: "gpt-5.2",
      isEnabled: true,
    };

    const body = await req.json();
    const {
      canvasId,
      executionId: propExecutionId,
      prompt,
      models,
      newNodeId,
      inputNodeId: providedInputNodeId,
      existingInputNodeId, // OPTIMISTIC UI: ID of node transformed from preview (already exists in frontend)
      parentNodeId, // Legacy support
      parentNodeIds, // New array support
      imageSize,
      imageQuality,
      imageN,
      attachments, // Legacy attachments
      fileAttachments, // New array of { storageId, type, name, size, position }
      isBranching, // NEW: Flag for lateral positioning
      videoAspectRatio,
      videoResolution,
      videoDuration,
      webSearchEnabled, // AI Features
      thinkingEnabled, // AI Features
      rlmForceFull, // RLM: force full mode (planner → workers → aggregator)
      position: clientPosition, // Optional: use for input node to avoid jump (preview position)
      kbRefs, // @-style KG refs (optional; when present, takes precedence over kbIds)
    } = body;
    // Note: body.kbIds and body.kbRefs are used in RAG context retrieval below

    // 1. Get user record and canvas details in parallel
    const [user, canvas] = await Promise.all([
      convex.query(api.users.users.getUserByClerkId, { clerkId }),
      convex.query(api.canvas.canvas.getCanvasByClerkId, { canvasId, clerkId })
    ]);

    if (!user) {
      return apiError("User not found", 404, "USER_NOT_FOUND");
    }

    if (!canvas) {
      return apiError("Canvas not found", 404, "CANVAS_NOT_FOUND");
    }

    if (user.plan === "pro" || user.plan === "payg" || user.plan === "starter" || user.plan === "free") {
      if ((user.balanceCredits ?? 0) <= 0) {
        return apiError("Añade créditos para continuar usando la plataforma.", 402, "INSUFFICIENT_CREDITS");
      }
    }

    const rlmSettings = await convex.query(api.users.settings.getRlmSettings);

    let executionId = propExecutionId;
    let nodesToQueue: CanvasNode[] = [];
    let canvasForContext = canvas; // Declare in outer scope

    if (!executionId && prompt && (newNodeId || providedInputNodeId)) {
      // Flowith-style dynamic creation: 1 Input Node -> N Response Nodes
      const modelsToProcess = Array.isArray(models) && models.length > 0 ? models : [DEFAULT_MODEL];

      executionId = await convex.mutation(api.canvas.canvasExecutions.createCanvasExecutionByClerkId, { canvasId, clerkId });

      // Consolidate parent IDs once
      const parents = parentNodeIds || (parentNodeId ? [parentNodeId] : []);

      const inputNodeSize = { width: 350, height: 200 };
      const hasValidClientPosition = clientPosition && typeof clientPosition.x === "number" && typeof clientPosition.y === "number";
      let inputNodeX: number;
      let inputNodeY: number;
      if (hasValidClientPosition) {
        inputNodeX = clientPosition.x;
        inputNodeY = clientPosition.y;
      } else {
        const inputNodePos = findBestPosition({
          nodes: canvas.nodes,
          edges: canvas.edges,
          anchorNodeId: parents[0],
          newNodeId: providedInputNodeId || `input-${newNodeId}`,
          newNodeSize: inputNodeSize,
          newNodeType: "input",
          isExplicitSelection: isBranching,
          skipCollisionAvoidance: true,
        });
        inputNodeX = inputNodePos.x;
        inputNodeY = inputNodePos.y;
      }

      // OPTIMISTIC UI: If existingInputNodeId is provided, the node already exists (transformed from preview)
      // We use that ID and just need to update/confirm it in the database
      const inputNodeId = providedInputNodeId || existingInputNodeId || `input-${newNodeId}`;
      const nodesToAdd: CanvasNode[] = [];
      const newEdges: CanvasEdge[] = [];
      const isOptimisticNode = !!existingInputNodeId && !providedInputNodeId;

      if (!providedInputNodeId && !existingInputNodeId) {
        // Create nodes and edges for file attachments (Files -> Hub)
        // Position files ABOVE the input node
        if (Array.isArray(fileAttachments)) {
          const FILE_WIDTH = 350;
          const FILE_SPACING = 20;
          const totalFilesWidth = fileAttachments.length * FILE_WIDTH + (fileAttachments.length - 1) * FILE_SPACING;
          const filesStartX = inputNodeX + (350 / 2) - (totalFilesWidth / 2);

          fileAttachments.forEach((fa, i) => {
            // Use provided ID if it's a short identifier (not a full S3 key path)
            const MAX_NODE_ID_LENGTH = 100;
            const fileNodeId = fa.id && typeof fa.id === 'string' && fa.id.length < MAX_NODE_ID_LENGTH
              ? fa.id
              : `file-${newNodeId}-${i}`;
            nodesToAdd.push({
              id: fileNodeId,
              type: "file",
              position: fa.position || {
                x: filesStartX + i * (FILE_WIDTH + FILE_SPACING),
                y: inputNodeY - 250 // Above input node
              },
              data: {
                fileName: fa.name,
                fileType: fa.type,
                fileSize: fa.size || 0,
                storageId: fa.storageId,
                uploadStatus: "complete",
                createdAt: Date.now(),
              }
            });

            newEdges.push({
              id: `edge-${fileNodeId}-${inputNodeId}`,
              source: fileNodeId,
              target: inputNodeId,
              animated: true,
            });
          });
        }

        // Create new input node (only if not optimistic and not provided)
        nodesToAdd.push({
          id: inputNodeId,
          type: "input",
          position: { x: inputNodeX, y: inputNodeY },
          data: {
            text: prompt,
            attachments,
            createdAt: Date.now(),
          }
        });

        // Create edges from all parent nodes to the NEW input node
        parents.forEach((pid: string) => {
          newEdges.push({
            id: `edge-${pid}-${inputNodeId}`,
            source: pid,
            target: inputNodeId,
            animated: true,
          });
        });
      } else if (isOptimisticNode) {
        // OPTIMISTIC UI: Node already exists from frontend transformation
        // We need to persist it to the database and confirm it
        console.log(`[Execute] Optimistic UI: Persisting transformed node ${existingInputNodeId}`);

        // Add the optimistic node to the database (it exists in frontend but not DB yet)
        nodesToAdd.push({
          id: inputNodeId,
          type: "input",
          position: { x: inputNodeX, y: inputNodeY },
          data: {
            text: prompt,
            attachments,
            createdAt: Date.now(),
          }
        });

        // Create edges from all parent nodes to the optimistic input node
        parents.forEach((pid: string) => {
          newEdges.push({
            id: `edge-${pid}-${inputNodeId}`,
            source: pid,
            target: inputNodeId,
            animated: true,
          });
        });

        // Handle file attachments for optimistic nodes too
        if (Array.isArray(fileAttachments)) {
          const FILE_WIDTH = 350;
          const FILE_SPACING = 20;
          const totalFilesWidth = fileAttachments.length * FILE_WIDTH + (fileAttachments.length - 1) * FILE_SPACING;
          const filesStartX = inputNodeX + (350 / 2) - (totalFilesWidth / 2);

          fileAttachments.forEach((fa, i) => {
            const MAX_NODE_ID_LENGTH = 100;
            const fileNodeId = fa.id && typeof fa.id === 'string' && fa.id.length < MAX_NODE_ID_LENGTH
              ? fa.id
              : `file-${newNodeId}-${i}`;
            nodesToAdd.push({
              id: fileNodeId,
              type: "file",
              position: fa.position || {
                x: filesStartX + i * (FILE_WIDTH + FILE_SPACING),
                y: inputNodeY - 250
              },
              data: {
                fileName: fa.name,
                fileType: fa.type,
                fileSize: fa.size || 0,
                storageId: fa.storageId,
                uploadStatus: "complete",
                createdAt: Date.now(),
              }
            });

            newEdges.push({
              id: `edge-${fileNodeId}-${inputNodeId}`,
              source: fileNodeId,
              target: inputNodeId,
              animated: true,
            });
          });
        }
      } else {
        // Update existing input node's text and attachments if they changed
        // This ensures the DB is consistent with the prompt sent
        try {
          await convex.mutation(api.canvas.canvas.updateNodeDataByClerkId, {
            canvasId,
            clerkId,
            nodeId: providedInputNodeId,
            data: {
              text: prompt,
              attachments,
            }
          });
        } catch (updateError) {
          console.error(
            `[Execute] Failed to update input node data:`,
            {
              canvasId,
              clerkId,
              nodeId: providedInputNodeId,
              prompt: prompt.substring(0, 100),
              attachmentsCount: attachments?.length || 0,
              error: updateError
            }
          );
          throw updateError;
        }
      }

      const responseNodes: CanvasNode[] = [];
      const responseEdges: CanvasEdge[] = []; // Track edges for response positioning

      modelsToProcess.forEach((model, i) => {
        const modelInfo = modelRegistry.getById(model.modelId);
        const isImageModel = !!modelInfo && modelInfo.primaryCapability === "image.generation";
        const isVideoModel = !!modelInfo && modelInfo.primaryCapability === "video.generation";
        const isDisplayModel = isImageModel || isVideoModel;

        const baseId = newNodeId ?? providedInputNodeId ?? `fallback-${Date.now()}`;
        const responseNodeId = `response-${baseId}-${i}`;

        const responseNodeSize = { width: 350, height: 400 };

        // Calculate position using the same logic as input nodes
        // Include all edges (existing + new input edges + already created response edges)
        const allEdges = [...canvas.edges, ...newEdges, ...responseEdges];
        // Prefer nodes we're adding so the anchor (input) is the one with correct position, not an old DB copy
        const allNodes = [...nodesToAdd, ...responseNodes, ...canvas.nodes];

        // Check if the input node already has response children (for branching detection)
        const existingResponseChildren = canvas.nodes.filter(n =>
          canvas.edges.some(e => e.source === inputNodeId && e.target === n.id) &&
          (n.type === 'response' || n.type === 'display')
        );
        const hasExistingResponses = existingResponseChildren.length > 0 || responseNodes.length > 0;

        const responseNodePos = findBestPosition({
          nodes: allNodes,
          edges: allEdges,
          anchorNodeId: inputNodeId,
          newNodeId: responseNodeId,
          newNodeSize: responseNodeSize,
          newNodeType: isDisplayModel ? "display" : "response",
          isParallel: modelsToProcess.length > 1,
          parallelIndex: i,
          totalParallel: modelsToProcess.length,
          isExplicitSelection: hasExistingResponses,
          skipCollisionAvoidance: true, // Keep response directly below input (no push far)
        });

        // Add the edge for this response node so subsequent nodes can detect it
        responseEdges.push({
          id: `edge-${inputNodeId}-${responseNodeId}`,
          source: inputNodeId,
          target: responseNodeId,
          animated: true,
        });

        const data: NodeData = isDisplayModel 
          ? {
              type: isImageModel ? "image" : "video",
              executionId,
              modelId: model.modelId,
              status: "pending",
              createdAt: Date.now(),
              text: "",
            } as DisplayNodeData
          : {
              executionId,
              modelId: model.modelId,
              status: "pending",
              createdAt: Date.now(),
              text: "",
            } as ResponseNodeData;

        responseNodes.push({
          id: responseNodeId,
          type: isDisplayModel ? "display" : "response",
          position: responseNodePos,
          data
        });
      });

      nodesToAdd.push(...responseNodes);

      // Add response edges (already created in the loop for proper sibling detection)
      newEdges.push(...responseEdges);

      // 3. Persist nodes and edges to DB
      await convex.mutation(api.canvas.canvas.addNodesAndEdgesByClerkId, {
        canvasId,
        clerkId,
        nodes: nodesToAdd,
        edges: newEdges,
      });
      
      // Re-query canvas to get the latest state with new nodes for context collection
      const updatedCanvas = await convex.query(api.canvas.canvas.getCanvasByClerkId, { canvasId, clerkId });
      canvasForContext = updatedCanvas ?? canvas;

      nodesToQueue = responseNodes;
    } else if (executionId) {
      // Resume existing execution
      const execution = await convex.query(api.canvas.canvasExecutions.getCanvasExecutionByClerkId, { executionId, clerkId });
      if (!execution) {
        return apiError("Execution not found", 404, "EXECUTION_NOT_FOUND");
      }

      // Re-query canvas to ensure we have the latest state
      const updatedCanvas = await convex.query(api.canvas.canvas.getCanvasByClerkId, { canvasId, clerkId });
      canvasForContext = updatedCanvas ?? canvas;

      // Find pending nodes from this execution
      const pendingNodes = canvas.nodes.filter(
        (n: CanvasNode) => n.data.executionId === executionId && n.data.status === "pending"
      );


      if (pendingNodes.length === 0) {
        return apiError("No pending nodes found for this execution", 400, "NO_PENDING_NODES");
      }

      nodesToQueue = pendingNodes;
    } else {
      return apiError("Invalid request: must provide either prompt or executionId", 400, "INVALID_INPUT");
    }

    // 4. Queue nodes in SQS with context
    const queueUrl = (user.plan === "pro" || user.plan === "payg")
      ? getRequiredEnv("SQS_QUEUE_URL_PRO")
      : getRequiredEnv("SQS_QUEUE_URL_FREE");

    // Import context resolution once before processing nodes
    const { resolveNodeContext } = await import("@/lib/reasoning/context");
    const { redis } = await import("@/lib/upstash/redis");

    if (!redis) {
      console.warn("[Execute] Redis client not available - file content fetching disabled");
    }

    // Helper to fetch file content from Redis
    const fetchFileContent = async (storageId: string): Promise<string | null> => {
      if (!redis) {
        console.warn(`[Execute] Redis not configured, cannot fetch content for: ${storageId}`);
        return null;
      }
      console.log(`\n========== FETCH FILE CONTENT ==========`);
      console.log(`[Execute] Attempting to fetch content for storageId: ${storageId}`);
      
      try {
        // 1. Try to find the file in Convex by S3 Key to get the real ID
        console.log(`[Execute] Step 1: Querying Convex for file record...`);
        const fileRecord = await convex.query(api.system.files.getFileByS3KeyPublic, { s3Key: storageId });
        
        let fileId: string | undefined = fileRecord?._id;
        console.log(`[Execute] Convex query result:`, fileRecord ? `Found file with ID: ${fileId}` : 'No file record found');
        
        if (fileRecord) {
          console.log(`[Execute] File status: ${fileRecord.status}`);
          if (fileRecord.errorMessage) {
            console.error(`[Execute] File error message: ${fileRecord.errorMessage}`);
          }
        }

        // 2. If not found in Convex (maybe race condition or legacy), try to extract UUID from S3 Key
        if (!fileId) {
           console.log(`[Execute] Step 2: Extracting UUID from S3 key as fallback...`);
           // S3 Key formats:
           // - New format (from Convex): raw/uuid.ext
           // - Old format (legacy): userId/uuid-filename.ext
           const parts = storageId.split('/');
           const filenamePart = parts[parts.length - 1];
           console.log(`[Execute] Filename part: ${filenamePart}`);
           
           // Try to extract UUID from filename
           const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
           const uuidBeforeDot = filenamePart.split('.')[0];
           
           if (UUID_REGEX.test(uuidBeforeDot)) {
             fileId = uuidBeforeDot;
             console.log(`[Execute] Using UUID from new format: ${fileId}`);
           } else {
             const uuidBeforeDash = filenamePart.split('-')[0];
             if (UUID_REGEX.test(uuidBeforeDash)) {
               fileId = uuidBeforeDash;
               console.log(`[Execute] Using UUID from old format: ${fileId}`);
             }
           }
        }

        if (!fileId) {
            console.error(`[Execute] ❌ FAILED: Could not resolve file ID for storageId: ${storageId}`);
            console.log(`========================================\n`);
            return null;
        }

        // 3. Fetch text from Redis
        console.log(`[Execute] Step 3: Fetching from Redis with key: file:${fileId}:text`);
        const redisKey = `file:${fileId}:text`;
        const text = await redis.get<string>(redisKey);
        
        if (text) {
            console.log(`[Execute] ✅ SUCCESS: Retrieved ${text.length} chars from Redis`);
            if (process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
              console.log(`[Execute] Content preview (first 200 chars): ${text.substring(0, 200)}...`);
            }
            console.log(`========================================\n`);
            return text;
        } else {
            console.warn(`[Execute] ⚠️  WARNING: No text found in Redis for key: ${redisKey}`);
            console.log(`[Execute] This means either:`);
            console.log(`[Execute]   1. File hasn't been processed by Lambda yet`);
            console.log(`[Execute]   2. Lambda failed to process the file`);
            console.log(`[Execute]   3. Redis key expired (TTL: 7 days)`);
            console.log(`========================================\n`);
            return null;
        }

      } catch (error) {
        console.error(`[Execute] ❌ ERROR fetching file content:`, error);
        console.log(`========================================\n`);
        return null;
      }
    };

    const jobs = await Promise.all(
      nodesToQueue.map(async (node) => {
        // Collect context using the reasoning logic with file content fetching
        const reasoningContext = await resolveNodeContext(
          node.id, 
          canvasForContext.nodes, 
          canvasForContext.edges,
          fetchFileContent
        );
        
        // Map to the format expected by the worker (or update worker to handle ReasoningContext)
        // For now, we pass the structured context in the inputs.

        const inputs = { 
          ...node.data,
          // Fix: Explicitly map 'prompt' and 'text' for the worker
          // The worker expects 'prompt' or 'text' to be populated.
          // We prioritize the explicit 'prompt' from the request body if available (for new executions),
          // otherwise fallback to node data (for regenerations).
          prompt: prompt || node.data?.prompt || node.data?.text || "",
          text: prompt || node.data?.text || node.data?.prompt || "",
          input: prompt || node.data?.text || node.data?.prompt || "", // Keep 'input' for backward compatibility if needed

          context: reasoningContext.items, // Pass the structured items
          reasoningContext, // Pass the full object for future proofing
          
          // RAG Context (from kbRefs @-style or legacy kbIds); only Pro has Knowledge Garden
          kbContext: user.plan === "pro"
            ? await resolveKbContext(convex, body, user._id, prompt || node.data?.text || "")
            : [],

          imageSize,
          imageQuality,
          imageN,
          videoAspectRatio,
          videoResolution,
          videoDuration,
          attachments,
          // AI Features (web search always available to model; only extended thinking is user-controlled)
          webSearchEnabled: true,
          thinkingEnabled: thinkingEnabled || false,
          rlmForceFull: rlmForceFull === true,
          // User RLM settings (merge with DEFAULT_RLM_CONFIG in worker)
          rlmSettings: rlmSettings ?? undefined,
          // Agent tools: enable all registered tools so the model can use them when needed
          toolNames: getRegisteredToolNames(),
          maxSteps: 8,
        };
        
        const messageBody = {
          messageId: `${executionId}-${node.id}`,
          executionId,
          nodeId: node.id,
          canvasId,
          nodeType: node.type,
          inputs,
          userId: user._id,
          timestamp: Date.now(),
        };

        const sqsResponse = await sendToQueue(queueUrl, messageBody, executionId);

        await inngest.send({
          name: "canvas/execute.task",
          data: {
            executionId,
            nodeId: node.id,
            canvasId,
            nodeType: node.type,
            inputs,
            userId: user._id,
          },
        });

        return {
          nodeId: node.id,
          jobId: sqsResponse.messageId,
        };
      })
    );

    return apiSuccess(
      { jobs },
      { message: `${jobs.length} nodes queued for execution` }
    );
  } catch (error) {
    console.error("[Execute] Error:", error);
    return apiError(
      error instanceof Error ? error.message : "Internal server error",
      500,
      "INTERNAL_ERROR"
    );
  }
}

// Main API route for node execution
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sendToQueue } from "@/lib/aws/sqs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { modelRegistry } from "@/shared/ai";
import { findBestPosition } from "@/lib/canvas/layout";
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

export async function POST(req: Request) {
  try {
    const { userId: clerkId, getToken } = await auth();
    
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[Execute] Authenticating for user ${clerkId}`);
    const token = await getToken({ template: "convex" });
    const convex = new ConvexHttpClient(getRequiredEnv("NEXT_PUBLIC_CONVEX_URL"));
    if (token) {
      console.log(`[Execute] Setting auth token (length: ${token.length})`);
      convex.setAuth(token);
    } else {
      console.error(`[Execute] Missing Convex auth token for template 'convex'`);
      return NextResponse.json({ error: "Convex auth token missing" }, { status: 401 });
    }

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
    } = body;
    // Note: body.kbIds is used directly in RAG context retrieval below

    // 1. Get user record and canvas details in parallel
    const [user, canvas] = await Promise.all([
      convex.query(api.users.users.getUserByClerkId, { clerkId }),
      convex.query(api.canvas.canvas.getCanvasByClerkId, { canvasId, clerkId })
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!canvas) {
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    let executionId = propExecutionId;
    let nodesToQueue: CanvasNode[] = [];
    let canvasForContext = canvas; // Declare in outer scope

    if (!executionId && prompt && (newNodeId || providedInputNodeId)) {
      // Flowith-style dynamic creation: 1 Input Node -> N Response Nodes
      const modelsToProcess = Array.isArray(models) && models.length > 0 ? models : [DEFAULT_MODEL];

      executionId = await convex.mutation(api.canvas.canvasExecutions.createCanvasExecutionByClerkId, { canvasId, clerkId });

      // Consolidate parent IDs once
      const parents = parentNodeIds || (parentNodeId ? [parentNodeId] : []);

      // Calculate position using intelligent layout
      const inputNodeSize = { width: 350, height: 200 };
      const inputNodePos = findBestPosition({
        nodes: canvas.nodes,
        edges: canvas.edges,
        anchorNodeId: parents[0], // Use the first parent as anchor
        newNodeId: providedInputNodeId || `input-${newNodeId}`, // Pass the ID of the node we are about to create
        newNodeSize: inputNodeSize,
        newNodeType: "input",
        isExplicitSelection: isBranching // Pass the flag
      });

      const inputNodeX = inputNodePos.x;
      const inputNodeY = inputNodePos.y;

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

        const responseNodeSize = { width: 500, height: 400 };

        // Calculate position using the same logic as input nodes
        // Include all edges (existing + new input edges + already created response edges)
        const allEdges = [...canvas.edges, ...newEdges, ...responseEdges];
        const allNodes = [...canvas.nodes, ...nodesToAdd, ...responseNodes];

        // Check if the input node already has response children (for branching detection)
        const existingResponseChildren = canvas.nodes.filter(n =>
          canvas.edges.some(e => e.source === inputNodeId && e.target === n.id) &&
          (n.type === 'response' || n.type === 'display')
        );
        const hasExistingResponses = existingResponseChildren.length > 0 || responseNodes.length > 0;

        const responseNodePos = findBestPosition({
          nodes: allNodes,
          edges: allEdges, // Pass edges so siblings can be detected
          anchorNodeId: inputNodeId,
          newNodeId: responseNodeId, // Pass the ID so it can be excluded from siblings check
          newNodeSize: responseNodeSize,
          newNodeType: isDisplayModel ? "display" : "response",
          isParallel: modelsToProcess.length > 1, // Only parallel if multiple models
          parallelIndex: i,
          totalParallel: modelsToProcess.length,
          isExplicitSelection: hasExistingResponses // Use lateral layout if already has responses
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
        return NextResponse.json({ error: "Execution not found" }, { status: 404 });
      }

      // Re-query canvas to ensure we have the latest state
      const updatedCanvas = await convex.query(api.canvas.canvas.getCanvasByClerkId, { canvasId, clerkId });
      canvasForContext = updatedCanvas ?? canvas;

      // Find pending nodes from this execution
      const pendingNodes = canvas.nodes.filter(
        (n: CanvasNode) => n.data.executionId === executionId && n.data.status === "pending"
      );


      if (pendingNodes.length === 0) {
        return NextResponse.json({ error: "No pending nodes found for this execution" }, { status: 400 });
      }

      nodesToQueue = pendingNodes;
    } else {
      return NextResponse.json({ error: "Invalid request: must provide either prompt or executionId" }, { status: 400 });
    }

    // 4. Queue nodes in SQS with context
    const queueUrl = user.plan === "pro" 
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
          
          // RAG Context
          kbContext: await (async () => {
             // 4. RAG Context Retrieval (if KBs selected)
             const queryText = prompt || node.data?.text || "";
             // Only search if explicitly selected KB IDs are provided (not canvasId which is wrong table)
             const kbIdsToSearch = body.kbIds && body.kbIds.length > 0 ? body.kbIds : [];

             if (kbIdsToSearch.length === 0 || !queryText) {
                return [];
             }

             // Validate ownership of each KB before searching
             const validatedKbIds: string[] = [];
             for (const kbId of kbIdsToSearch) {
                try {
                   const kb = await convex.query(api.knowledge_garden.knowledgeBases.get, { id: kbId });
                   // The get query already validates ownership via auth, returns null if unauthorized
                   if (kb && kb.userId === user._id) {
                      validatedKbIds.push(kbId);
                   } else {
                      console.warn(`[Execute] KB ${kbId} not owned by user ${user._id}, skipping`);
                   }
                } catch (err) {
                   console.warn(`[Execute] Failed to validate KB ${kbId}:`, err);
                }
             }

             if (validatedKbIds.length === 0) {
                console.log(`[Execute] No valid KBs after ownership check`);
                return [];
             }

             console.log(`[Execute] Searching Knowledge Bases: ${validatedKbIds.join(", ")}`);
             try {
                const searchResults = await convex.query(api.knowledge_garden.seeds.search, {
                   query: queryText,
                   kbIds: validatedKbIds,
                   limit: 5,
                });

                if (searchResults && searchResults.length > 0) {
                   console.log(`[Execute] Found ${searchResults.length} relevant snippets.`);
                   return searchResults.map(seed => ({
                      id: seed._id,
                      title: seed.title,
                      content: seed.fullText || seed.summary || "",
                      kbId: seed.kbId,
                      score: 1 // Placeholder score
                   }));
                }
              } catch (err) {
                console.error("[Execute] KB Search failed:", err);
                return [];
              }
              return [];
           })(),

          imageSize,
          imageQuality,
          imageN,
          videoAspectRatio,
          videoResolution,
          videoDuration,
          attachments,
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
        
        return {
          nodeId: node.id,
          jobId: sqsResponse.messageId,
        };
      })
    );

    return NextResponse.json({
      success: true,
      jobs,
      message: `${jobs.length} nodes queued for execution`,
    });

  } catch (error) {
    console.error("Canvas execution error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

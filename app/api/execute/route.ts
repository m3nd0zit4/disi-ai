// Main API route for node execution
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sendToQueue } from "@/lib/sqs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
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

/**
 * Retrieve the value of an environment variable by its key.
 *
 * @param key - The environment variable name to look up
 * @returns The environment variable's value
 * @throws Error when the environment variable is not defined
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const convex = new ConvexHttpClient(getRequiredEnv("NEXT_PUBLIC_CONVEX_URL"));

// Default model configuration
const DEFAULT_MODEL = {
  category: "reasoning" as const,
  modelId: "gpt-5.2",
  provider: "GPT",
  providerModelId: "gpt-5.2",
  isEnabled: true,
};

/**
 * Handle POST requests to create or resume canvas executions, persist any new nodes/edges,
 * resolve execution context for each pending node, and enqueue node jobs to SQS for processing.
 *
 * This endpoint authenticates the caller, validates the canvas and user, then either:
 * - Creates a new execution with an input node (or updates an existing input node), generates one or more response/display nodes (positioned via layout logic), persists nodes and edges, and enqueues those response nodes; or
 * - Resumes an existing execution by finding pending nodes and enqueuing them.
 *
 * The queued message for each node includes node inputs, resolved reasoning context, image/attachment options, and execution identifiers.
 *
 * @returns A JSON NextResponse: on success `{"success": true, "jobs": [{ nodeId, jobId }, ...], "message": string}`; on error an `{"error": string}` response with an appropriate HTTP status (401, 404, 400, or 500).
 */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { 
      canvasId, 
      executionId: propExecutionId, 
      prompt, 
      models, 
      newNodeId, 
      inputNodeId: providedInputNodeId,
      parentNodeId, // Legacy support
      parentNodeIds, // New array support
      imageSize,
      imageQuality,
      imageBackground,
      imageOutputFormat,
      imageN,
      imageModeration,
      attachments, // Legacy attachments
      fileAttachments, // New array of { storageId, type, name, size, position }
      isBranching, // NEW: Flag for lateral positioning
    } = body;

    // 1. Get user record
    const user = await convex.query(api.users.getUserByClerkId, { clerkId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Get canvas details
    const canvas = await convex.query(api.canvas.getCanvasByClerkId, { canvasId, clerkId });
    if (!canvas) {
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    let executionId = propExecutionId;
    let nodesToQueue: CanvasNode[] = [];
    let canvasForContext = canvas; // Declare in outer scope

    if (!executionId && prompt && (newNodeId || providedInputNodeId)) {
      // Flowith-style dynamic creation: 1 Input Node -> N Response Nodes
      const modelsToProcess = Array.isArray(models) && models.length > 0 ? models : [DEFAULT_MODEL];

      executionId = await convex.mutation(api.canvasExecutions.createCanvasExecutionByClerkId, { canvasId, clerkId });

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

      const inputNodeId = providedInputNodeId || `input-${newNodeId}`;
      const nodesToAdd: CanvasNode[] = [];
      const newEdges: CanvasEdge[] = [];

      if (!providedInputNodeId) {
        // Create nodes and edges for file attachments (Files -> Hub)
        // Position files ABOVE the input node
        if (Array.isArray(fileAttachments)) {
          const FILE_WIDTH = 350;
          const FILE_SPACING = 20;
          const totalFilesWidth = fileAttachments.length * FILE_WIDTH + (fileAttachments.length - 1) * FILE_SPACING;
          const filesStartX = inputNodeX + (350 / 2) - (totalFilesWidth / 2);

          fileAttachments.forEach((fa, i) => {
            const fileNodeId = `file-${newNodeId}-${i}`;
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

        // Create new input node
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
      } else {
        // Update existing input node's text and attachments if they changed
        // This ensures the DB is consistent with the prompt sent
        try {
          await convex.mutation(api.canvas.updateNodeDataByClerkId, {
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
      modelsToProcess.forEach((model, i) => {
        const modelInfo = SPECIALIZED_MODELS.find(m => m.id === model.modelId);
        const isImageModel = !!modelInfo && modelInfo.category === "image";
        const baseId = newNodeId ?? providedInputNodeId ?? `fallback-${Date.now()}`;
        const responseNodeId = `response-${baseId}-${i}`;
        
        const responseNodeSize = { width: 500, height: 400 };
        const responseNodePos = findBestPosition({
          nodes: [...canvas.nodes, ...nodesToAdd], // Include the newly created input node
          anchorNodeId: inputNodeId,
          newNodeSize: responseNodeSize,
          newNodeType: isImageModel ? "display" : "response",
          isParallel: true,
          parallelIndex: i,
          totalParallel: modelsToProcess.length
        });

        const data: NodeData = isImageModel 
          ? {
              type: "image",
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
          type: isImageModel ? "display" : "response",
          position: responseNodePos,
          data
        });
      });

      nodesToAdd.push(...responseNodes);

      // Create edges from the input node (new or existing) to response nodes
      responseNodes.forEach(node => {
        newEdges.push({
          id: `edge-${inputNodeId}-${node.id}`,
          source: inputNodeId,
          target: node.id,
          animated: true,
        });
      });

      // 3. Persist nodes and edges to DB
      await convex.mutation(api.canvas.addNodesAndEdgesByClerkId, {
        canvasId,
        clerkId,
        nodes: nodesToAdd,
        edges: newEdges,
      });
      
      // Re-query canvas to get the latest state with new nodes for context collection
      const updatedCanvas = await convex.query(api.canvas.getCanvasByClerkId, { canvasId, clerkId });
      canvasForContext = updatedCanvas ?? canvas;

      nodesToQueue = responseNodes;
    } else if (executionId) {
      // Resume existing execution
      const execution = await convex.query(api.canvasExecutions.getCanvasExecutionByClerkId, { executionId, clerkId });
      if (!execution) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 });
      }

      // Re-query canvas to ensure we have the latest state
      const updatedCanvas = await convex.query(api.canvas.getCanvasByClerkId, { canvasId, clerkId });
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

    const jobs = await Promise.all(
      nodesToQueue.map(async (node) => {
        // Collect context using the reasoning logic
        const reasoningContext = resolveNodeContext(node.id, canvasForContext.nodes, canvasForContext.edges);
        
        // Map to the format expected by the worker (or update worker to handle ReasoningContext)
        // For now, we'll pass the structured context in the inputs.


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
          imageSize,
          imageQuality,
          imageBackground,
          imageOutputFormat,
          imageN,
          imageModeration,
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
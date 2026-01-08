// Main API route for node execution
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sendToQueue } from "@/lib/sqs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const convex = new ConvexHttpClient(getRequiredEnv("NEXT_PUBLIC_CONVEX_URL"));

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
      targetNodeId,
      imageSize,
      imageQuality,
      imageBackground,
      imageOutputFormat,
      imageN,
      imageModeration,
      attachments, // Array of { storageId, type, name, size }
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
    let nodesToQueue = [];

    if (!executionId && prompt && (newNodeId || providedInputNodeId)) {
      // Flowith-style dynamic creation: 1 Input Node -> N Response Nodes
      const modelsToProcess = Array.isArray(models) && models.length > 0 ? models : [{
        category: "reasoning",
        modelId: "gpt-5.2",
        provider: "GPT",
        providerModelId: "gpt-5.2",
        isEnabled: true,
      }];

      executionId = await convex.mutation(api.canvasExecutions.createCanvasExecutionByClerkId, { canvasId, clerkId });

      // Calculate position based on parent node or use passed position
      let startX = 100;
      let startY = canvas.nodes.length * 200 + 100;
      
      if (body.position) {
        startX = body.position.x;
        startY = body.position.y;
      } else {
        const parents = parentNodeIds || (parentNodeId ? [parentNodeId] : []);
        if (parents.length > 0) {
            const parentNodes = canvas.nodes.filter(n => parents.includes(n.id));
            if (parentNodes.length > 0) {
                const avgX = parentNodes.reduce((sum, n) => sum + n.position.x, 0) / parentNodes.length;
                const maxY = Math.max(...parentNodes.map(n => n.position.y));
                
                startX = avgX;
                startY = maxY + 400;
            }
        }
      }

      const RESPONSE_WIDTH = 500;
      const SPACING = 40;
      const totalResponseWidth = modelsToProcess.length * RESPONSE_WIDTH + (modelsToProcess.length - 1) * SPACING;
      
      const inputNodeX = startX + (totalResponseWidth / 2) - (350 / 2);
      const inputNodeY = startY;

      const inputNodeId = providedInputNodeId || `input-${newNodeId}`;
      const nodesToAdd = [];
      const newEdges = [];

      if (!providedInputNodeId) {
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
        const parents = parentNodeIds || (parentNodeId ? [parentNodeId] : []);
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
        await convex.mutation(api.canvas.updateNodeDataByClerkId, {
          canvasId,
          clerkId,
          nodeId: providedInputNodeId,
          data: {
            text: prompt,
            attachments,
          }
        });
      }

      const responseNodes = modelsToProcess.map((model, i) => {
        const modelInfo = SPECIALIZED_MODELS.find(m => m.id === model.modelId);
        const isImageModel = !!modelInfo && modelInfo.category === "image";

        return {
          id: `response-${newNodeId}-${i}`,
          type: isImageModel ? "display" : "response",
          position: { 
            x: startX + i * (RESPONSE_WIDTH + SPACING), 
            y: inputNodeY + 300 
          },
          data: {
            text: "",
            modelId: model.modelId,
            status: "pending",
            createdAt: Date.now(),
            isImageNode: isImageModel,
            type: isImageModel ? "image" : undefined,
          }
        };
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

      // Add all at once
      await convex.mutation(api.canvas.addNodesAndEdgesByClerkId, { 
        canvasId, 
        clerkId,
        nodes: nodesToAdd,
        edges: newEdges 
      });
      
      // Re-query canvas to get the latest state with new nodes for context collection
      const updatedCanvas = await convex.query(api.canvas.getCanvasByClerkId, { canvasId, clerkId });
      if (updatedCanvas) {
        canvas.nodes = updatedCanvas.nodes;
        canvas.edges = updatedCanvas.edges;
      }

      nodesToQueue = responseNodes;
    } else if (executionId) {
      // Standard execution flow with context collection
      const nodes = canvas.nodes;
      
      if (targetNodeId) {
        // Prioritize specific node if requested (e.g. regeneration)
        const targetNode = nodes.find(n => n.id === targetNodeId);
        if (targetNode) {
          nodesToQueue = [targetNode];
        } else {
           console.warn(`Target node ${targetNodeId} not found in canvas`);
        }
      } else {
        // Find nodes that need execution (e.g., pending response nodes)
        nodesToQueue = nodes.filter(n => n.data?.status === "pending");
      }
      
      if (nodesToQueue.length === 0 && nodes.length > 0) {
        // Fallback or manual trigger logic
        nodesToQueue = [nodes[nodes.length - 1]];
      }

      // If prompt is provided in body (e.g. from regenerateNode), inject it into the node data
      if (prompt && nodesToQueue.length === 1) {
        nodesToQueue[0].data = {
          ...nodesToQueue[0].data,
          prompt: prompt
        };
      }
    } else {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    // 4. Queue nodes in SQS with context
    const queueUrl = user.plan === "pro" 
      ? getRequiredEnv("SQS_QUEUE_URL_PRO")
      : getRequiredEnv("SQS_QUEUE_URL_FREE");

    const jobs = await Promise.all(
      nodesToQueue.map(async (node) => {
        // Collect context using the new reasoning logic
        const { resolveNodeContext } = await import("@/lib/reasoning/context");
        const reasoningContext = resolveNodeContext(node.id, canvas.nodes, canvas.edges);
        
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
          jobId: sqsResponse.MessageId,
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

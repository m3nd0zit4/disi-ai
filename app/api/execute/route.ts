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
      parentNodeId, 
      targetNodeId,
      imageSize,
      imageQuality,
      imageBackground,
      imageOutputFormat,
      imageN,
      imageModeration
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

    if (!executionId && prompt && newNodeId) {
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
      } else if (parentNodeId) {
        const parentNode = canvas.nodes.find(n => n.id === parentNodeId);
        if (parentNode) {
          startX = parentNode.position.x;
          startY = parentNode.position.y + 400; // Place below parent
        }
      }

      const inputNodeId = `input-${newNodeId}`;
      const inputNode = {
        id: inputNodeId,
        type: "input",
        position: { x: startX, y: startY },
        data: {
          text: prompt,
          createdAt: Date.now(),
        }
      };

      const responseNodes = modelsToProcess.map((model, i) => {
        const modelInfo = SPECIALIZED_MODELS.find(m => m.id === model.modelId);
        const isImageModel = modelInfo?.category === "image";

        return {
          id: `response-${newNodeId}-${i}`,
          type: isImageModel ? "display" : "response",
          position: { 
            x: startX + (i * 420), 
            y: startY + 250 
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

      const newEdges = responseNodes.map(node => ({
        id: `edge-${inputNodeId}-${node.id}`,
        source: inputNodeId,
        target: node.id,
        animated: true,
      }));

      // Create edge from parent to new input node if parent exists
      if (parentNodeId) {
        newEdges.push({
          id: `edge-${parentNodeId}-${inputNodeId}`,
          source: parentNodeId,
          target: inputNodeId,
          animated: true,
        });
      }

      // Add all at once
      await convex.mutation(api.canvas.addNodesAndEdgesByClerkId, { 
        canvasId, 
        clerkId,
        nodes: [inputNode, ...responseNodes],
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
        // Collect context from parent nodes
        const parentNodes = [];
        const visited = new Set();
        const queue = [node.id];
        
        while (queue.length > 0) {
          const currentId = queue.shift();
          if (visited.has(currentId)) continue;
          visited.add(currentId);
          
          const incomingEdges = canvas.edges.filter(e => e.target === currentId);
          for (const edge of incomingEdges) {
            const parent = canvas.nodes.find(n => n.id === edge.source);
            if (parent) {
              parentNodes.push({
                id: parent.id,
                type: parent.type,
                content: parent.data?.text || parent.data?.userInput || parent.data?.output?.text || "",
              });
              queue.push(parent.id);
            }
          }
        }

        const inputs = { 
          ...node.data,
          // Fix: Explicitly map 'prompt' and 'text' for the worker
          // The worker expects 'prompt' or 'text' to be populated.
          // We prioritize the explicit 'prompt' from the request body if available (for new executions),
          // otherwise fallback to node data (for regenerations).
          prompt: prompt || node.data?.prompt || node.data?.text || "",
          text: prompt || node.data?.text || node.data?.prompt || "",
          input: prompt || node.data?.text || node.data?.prompt || "", // Keep 'input' for backward compatibility if needed
          context: parentNodes.reverse(), // Order from root to parent
          imageSize,
          imageQuality,
          imageBackground,
          imageOutputFormat,
          imageN,
          imageModeration,
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

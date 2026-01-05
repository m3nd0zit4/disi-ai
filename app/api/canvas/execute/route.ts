import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sendToQueue } from "@/lib/sqs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export async function POST(req: Request) {
  console.log("POST /api/canvas/execute hit");
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { canvasId, executionId: propExecutionId, prompt, models, newNodeId } = body;

    // Validate required fields
    if (!canvasId || typeof canvasId !== 'string') {
      return NextResponse.json({ error: "Invalid canvasId" }, { status: 400 });
    }

    if (!propExecutionId && (!prompt || !newNodeId)) {
      return NextResponse.json({ 
        error: "Either executionId or (prompt + newNodeId) must be provided" 
      }, { status: 400 });
    }

    // 1. Get user record
    const user = await convex.query(api.users.getUserByClerkId, { clerkId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Get canvas details (Authorized)
    const canvas = await convex.query(api.canvas.getCanvasByClerkId, { canvasId, clerkId });
    if (!canvas) {
      return NextResponse.json({ error: "Canvas not found or unauthorized" }, { status: 404 });
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

      executionId = await convex.mutation(api.canvasExecutions.createCanvasExecutionByClerkId, { 
        canvasId,
        clerkId 
      });

      const inputNodeId = `input-${newNodeId}`;
      const inputNode = {
        id: inputNodeId,
        type: "input",
        position: { x: 100, y: canvas.nodes.length * 200 + 100 },
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
            x: 100 + (i * 420), 
            y: (canvas.nodes.length + 1) * 200 + 150 
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

      const edges = responseNodes.map(node => ({
        id: `edge-${inputNodeId}-${node.id}`,
        source: inputNodeId,
        target: node.id,
        animated: true,
      }));

      // Add all at once (Authorized)
      await convex.mutation(api.canvas.addNodesAndEdgesByClerkId, { 
        canvasId, 
        clerkId,
        nodes: [inputNode, ...responseNodes],
        edges 
      });

      nodesToQueue = responseNodes;
    } else if (executionId) {
      // Standard execution flow with context collection
      const nodes = canvas.nodes;
      
      // Find nodes that need execution (e.g., pending response nodes)
      // For now, we'll just queue nodes that are targets of new connections or manually triggered
      // In a real flow, we'd find nodes with status "pending"
      nodesToQueue = nodes.filter(n => n.data?.status === "pending");
      
      if (nodesToQueue.length === 0 && nodes.length > 0) {
        // Fallback or manual trigger logic
        nodesToQueue = [nodes[nodes.length - 1]];
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
          context: parentNodes.reverse(), // Order from root to parent
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

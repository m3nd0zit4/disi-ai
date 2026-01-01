import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sendToQueue } from "@/lib/sqs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { canvasId, executionId: propExecutionId, prompt, models, newNodeId, parentNodeId } = body;

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

      // Calculate position based on parent node
      let startX = 100;
      let startY = canvas.nodes.length * 200 + 100;
      
      if (parentNodeId) {
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

      const responseNodes = modelsToProcess.map((model, i) => ({
        id: `response-${newNodeId}-${i}`,
        type: "response",
        position: { 
          x: startX + (i * 420), 
          y: startY + 250 
        },
        data: {
          text: "",
          modelId: model.modelId,
          status: "pending",
          createdAt: Date.now(),
        }
      }));

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
      
      // Find nodes that need execution (e.g., pending response nodes)
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
      ? process.env.SQS_QUEUE_URL_PRO! 
      : process.env.SQS_QUEUE_URL_FREE!;

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

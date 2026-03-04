import { auth } from "@clerk/nextjs/server";
import { sendToQueue } from "@/lib/aws/sqs";
import { inngest } from "@/lib/inngest/client";
import { api } from "@/convex/_generated/api";
import { modelRegistry } from "@/shared/ai";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getConvexClient } from "@/lib/convex-client";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRegisteredToolNames } from "@/lib/agent/tools/registry";

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
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }
    const rl = await checkRateLimit(clerkId, "canvas-execute");
    if (!rl.success) {
      return apiError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
    }

    const body = await req.json();
    const { canvasId, executionId: propExecutionId, prompt, models, newNodeId } = body;

    // Validate required fields
    if (!canvasId || typeof canvasId !== "string") {
      return apiError("Invalid canvasId", 400, "INVALID_INPUT");
    }

    if (!propExecutionId && (!prompt || !newNodeId)) {
      return apiError(
        "Either executionId or (prompt + newNodeId) must be provided",
        400,
        "INVALID_INPUT"
      );
    }

    const convex = getConvexClient();
    // 1. Get user and canvas in parallel
    const [user, canvas] = await Promise.all([
      convex.query(api.users.users.getUserByClerkId, { clerkId }),
      convex.query(api.canvas.canvas.getCanvasByClerkId, { canvasId: canvasId as any, clerkId }),
    ]);
    if (!user) {
      return apiError("User not found", 404, "USER_NOT_FOUND");
    }
    if (!canvas) {
      return apiError("Canvas not found or unauthorized", 404, "CANVAS_NOT_FOUND");
    }

    if (user.plan === "pro" || user.plan === "payg" || user.plan === "starter" || user.plan === "free") {
      if ((user.balanceCredits ?? 0) <= 0) {
        return apiError("Añade créditos para continuar usando la plataforma.", 402, "INSUFFICIENT_CREDITS");
      }
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

      executionId = await convex.mutation(api.canvas.canvasExecutions.createCanvasExecutionByClerkId, { 
        canvasId: canvasId as any,
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
        const modelInfo = modelRegistry.getById(model.modelId);
        const isImageModel = !!modelInfo && modelInfo.primaryCapability === "image.generation";

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
      await convex.mutation(api.canvas.canvas.addNodesAndEdgesByClerkId, { 
        canvasId: canvasId as any, 
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
      nodesToQueue = nodes.filter((n: any) => n.data?.status === "pending");
      
      if (nodesToQueue.length === 0 && nodes.length > 0) {
        // Fallback or manual trigger logic
        nodesToQueue = [nodes[nodes.length - 1]];
      }
    } else {
      return apiError("Invalid request parameters", 400, "INVALID_INPUT");
    }

    // 4. Queue nodes in SQS with context
    const queueUrl = (user.plan === "pro" || user.plan === "payg")
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
    console.error("[Canvas Execute] Error:", error);
    return apiError(
      error instanceof Error ? error.message : "Internal server error",
      500,
      "INTERNAL_ERROR"
    );
  }
}

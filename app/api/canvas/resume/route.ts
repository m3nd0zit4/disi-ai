import { auth } from "@clerk/nextjs/server";
import { inngest } from "@/lib/inngest/client";
import { api } from "@/convex/_generated/api";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getConvexClient } from "@/lib/convex-client";
import { getTool } from "@/lib/agent/tools/registry";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await req.json();
    const { canvasId, nodeId, executionId, callId, confirmed } = body;

    if (!canvasId || typeof canvasId !== "string" || !nodeId || typeof nodeId !== "string") {
      return apiError("canvasId and nodeId are required", 400, "INVALID_INPUT");
    }
    if (typeof confirmed !== "boolean") {
      return apiError("confirmed must be a boolean", 400, "INVALID_INPUT");
    }

    const convex = getConvexClient();
    const [user, canvas] = await Promise.all([
      convex.query(api.users.users.getUserByClerkId, { clerkId }),
      convex.query(api.canvas.canvas.getCanvasByClerkId, {
        canvasId: canvasId as import("@/convex/_generated/dataModel").Id<"canvas">,
        clerkId,
      }),
    ]);
    if (!user) return apiError("User not found", 404, "USER_NOT_FOUND");
    if (!canvas) {
      return apiError("Canvas not found or unauthorized", 404, "CANVAS_NOT_FOUND");
    }

    const node = (canvas.nodes as Array<{ id: string; data?: Record<string, unknown> }>).find(
      (n) => n.id === nodeId
    );
    if (!node?.data) {
      return apiError("Node not found", 404, "NODE_NOT_FOUND");
    }

    const agentState = node.data.agentState as string | undefined;
    const pendingToolCall = node.data.pendingToolCall as
      | { tool: string; args?: Record<string, unknown>; callId?: string }
      | undefined;

    if (agentState !== "waiting_confirmation" || !pendingToolCall) {
      return apiError("Node is not waiting for confirmation", 400, "NOT_WAITING_CONFIRMATION");
    }
    if (callId != null && pendingToolCall.callId !== callId) {
      return apiError("callId does not match pending tool call", 400, "CALL_ID_MISMATCH");
    }

    if (!confirmed) {
      await convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
        canvasId: canvasId as import("@/convex/_generated/dataModel").Id<"canvas">,
        nodeId,
        data: {
          agentState: "completed",
          pendingToolCall: undefined,
        },
      });
      return apiSuccess({ cancelled: true }, { message: "Action cancelled" });
    }

    const tool = getTool(pendingToolCall.tool);
    if (!tool) {
      return apiError(`Tool ${pendingToolCall.tool} not found`, 400, "TOOL_NOT_FOUND");
    }

    let toolResult: unknown;
    try {
      toolResult = await tool.execute(pendingToolCall.args ?? {});
    } catch (err) {
      console.error("[Resume] Tool execution failed", { tool: pendingToolCall.tool, error: err });
      await convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
        canvasId: canvasId as import("@/convex/_generated/dataModel").Id<"canvas">,
        nodeId,
        data: {
          agentState: "failed",
          pendingToolCall: undefined,
          error: err instanceof Error ? err.message : "Tool execution failed",
        },
      });
      return apiError("Tool execution failed", 500, "TOOL_EXECUTION_FAILED");
    }

    const toolCallsHistory = (node.data.toolCallsHistory as Array<Record<string, unknown>>) ?? [];
    toolCallsHistory.push({
      tool: pendingToolCall.tool,
      status: "completed",
      input: pendingToolCall.args,
      output: toolResult,
      callId: pendingToolCall.callId,
    });

    await convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
      canvasId: canvasId as import("@/convex/_generated/dataModel").Id<"canvas">,
      nodeId,
      data: {
        agentState: "completed",
        pendingToolCall: undefined,
        toolCallsHistory,
      },
    });

    await inngest.send({
      name: "canvas/resume.task",
      data: {
        canvasId,
        nodeId,
        executionId: executionId ?? undefined,
        toolResult,
        pendingToolCall,
        currentText: node.data.text,
        inputs: {
          modelId: node.data.modelId,
          provider: node.data.provider,
          systemPrompt: node.data.systemPrompt,
        },
        userId: user._id,
      },
    });

    return apiSuccess({ resumed: true }, { message: "Tool executed; continuation queued" });
  } catch (error) {
    console.error("[Canvas Resume] Error:", error);
    return apiError(
      error instanceof Error ? error.message : "Internal server error",
      500,
      "INTERNAL_ERROR"
    );
  }
}

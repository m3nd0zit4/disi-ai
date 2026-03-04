import { inngest } from "@/lib/inngest/client";
import { runNodeExecution } from "@/lib/worker/process-node";
import type { NodeExecutionPayload } from "@/workers/ai/types";

export const canvasExecuteTask = inngest.createFunction(
  {
    id: "canvas-execute-task",
    retries: 2,
  },
  { event: "canvas/execute.task" },
  async ({ event }) => {
    const data = event.data as NodeExecutionPayload;
    console.log("[Inngest] canvas-execute-task started", {
      eventId: event.id,
      nodeId: data.nodeId,
      executionId: data.executionId,
    });
    try {
      await runNodeExecution(data);
      console.log("[Inngest] canvas-execute-task completed", { nodeId: data.nodeId });
    } catch (err) {
      console.error("[Inngest] canvas-execute-task failed", { nodeId: data.nodeId, error: err });
      throw err;
    }
  }
);

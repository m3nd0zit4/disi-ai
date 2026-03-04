import { inngest } from "@/lib/inngest/client";
import { runResumeContinuation } from "@/lib/worker/process-node";

export interface CanvasResumePayload {
  canvasId: string;
  nodeId: string;
  executionId?: string;
  toolResult: unknown;
  pendingToolCall: { tool: string; args?: Record<string, unknown>; callId?: string };
  currentText: string;
  inputs: { modelId?: string; provider?: string; systemPrompt?: string };
  userId?: string;
}

export const canvasResumeTask = inngest.createFunction(
  {
    id: "canvas-resume-task",
    retries: 2,
  },
  { event: "canvas/resume.task" },
  async ({ event }) => {
    const data = event.data as CanvasResumePayload;
    console.log("[Inngest] canvas-resume-task started", {
      eventId: event.id,
      nodeId: data.nodeId,
      canvasId: data.canvasId,
    });
    try {
      await runResumeContinuation(data);
      console.log("[Inngest] canvas-resume-task completed", { nodeId: data.nodeId });
    } catch (err) {
      console.error("[Inngest] canvas-resume-task failed", { nodeId: data.nodeId, error: err });
      throw err;
    }
  }
);

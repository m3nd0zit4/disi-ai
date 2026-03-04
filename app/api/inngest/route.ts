import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { canvasExecuteTask } from "@/lib/inngest/functions/canvas-execute";
import { canvasResumeTask } from "@/lib/inngest/functions/canvas-resume";
import { fileProcessTask } from "@/lib/inngest/functions/file-process";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [canvasExecuteTask, canvasResumeTask, fileProcessTask],
});

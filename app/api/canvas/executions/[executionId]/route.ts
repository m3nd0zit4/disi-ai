import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";
import { apiSuccess, apiError } from "@/lib/api-response";
import { Id } from "@/convex/_generated/dataModel";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params;
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }
  const token = await getToken({ template: "convex" });
  const convex = getConvexClient(token ?? undefined);
  const execution = await convex.query(api.canvas.canvasExecutions.getCanvasExecutionByClerkId, {
    executionId: executionId as Id<"canvasExecutions">,
    clerkId,
  });
  if (!execution) {
    return apiError("Execution not found", 404, "NOT_FOUND");
  }
  return apiSuccess({ execution });
}

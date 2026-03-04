import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";
import { apiSuccess, apiError } from "@/lib/api-response";
import { Id } from "@/convex/_generated/dataModel";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ canvasId: string }> }
) {
  const { canvasId } = await params;
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }
  const token = await getToken({ template: "convex" });
  const convex = getConvexClient(token ?? undefined);
  const canvas = await convex.query(api.canvas.canvas.getCanvasByClerkId, {
    canvasId: canvasId as Id<"canvas">,
    clerkId,
  });
  if (!canvas) {
    return apiError("Canvas not found", 404, "NOT_FOUND");
  }
  return apiSuccess({ canvas });
}

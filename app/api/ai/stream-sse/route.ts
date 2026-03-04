import { auth } from "@clerk/nextjs/server";
import { subscribeStream, unsubscribeStream, isPoolAvailable } from "@/lib/redis-sse-pool";
import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-client";
import { Id } from "@/convex/_generated/dataModel";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const { searchParams } = new URL(req.url);
  const responseId = searchParams.get("responseId");

  if (!responseId) {
    return apiError("Missing responseId", 400, "INVALID_INPUT");
  }

  try {
    const token = await getToken({ template: "convex" });
    const convex = getConvexClient(token ?? undefined);
    const isOwner = await convex.query(api.users.users.verifyResponseOwnership, {
      responseId: responseId as Id<"modelResponses">,
    });

    if (!isOwner) {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }
  } catch (error) {
    console.error("[SSE] Ownership check failed:", error);
    return apiError("Internal Server Error", 500, "INTERNAL_ERROR");
  }

  if (!isPoolAvailable()) {
    return apiError("Redis not configured", 503, "REDIS_UNAVAILABLE");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const cleanup = () => {
        unsubscribeStream(responseId).catch(() => {});
        try {
          controller.close();
        } catch {
          // stream may already be closed
        }
      };

      const ok = subscribeStream(responseId, controller, encoder, cleanup);
      if (!ok) {
        controller.close();
        return;
      }

      req.signal.addEventListener("abort", () => {
        cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

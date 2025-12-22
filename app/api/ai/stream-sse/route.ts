import { auth } from "@clerk/nextjs/server";
import { getRedisSubscriber } from "@/lib/redis";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const responseId = searchParams.get("responseId");

  if (!responseId) {
    return new Response("Missing responseId", { status: 400 });
  }

  // *Verify ownership
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const token = await getToken({ template: "convex" });
    if (token) {
      convex.setAuth(token);
    }

    const isOwner = await convex.query(api.conversations.verifyResponseOwnership, {
      responseId: responseId as Id<"modelResponses">,
    });

    if (!isOwner) {
      return new Response("Forbidden", { status: 403 });
    }
  } catch (error) {
    console.error("[SSE] Ownership check failed:", error);
    return new Response("Internal Server Error", { status: 500 });
  }

  const encoder = new TextEncoder();
  const subscriber = getRedisSubscriber();

  if (!subscriber) {
    return new Response("Redis not configured", { status: 500 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const channel = `stream:${responseId}`;

      await subscriber.subscribe(channel);

      subscriber.on("message", (chan, message) => {
        if (chan === channel) {
          const data = `data: ${message}\n\n`;
          controller.enqueue(encoder.encode(data));

          try {
            const parsed = JSON.parse(message);
            if (parsed.status === "completed" || parsed.status === "error") {
              cleanup();
            }
          } catch {
            // Ignore parse errors
          }
        }
      });

      const cleanup = async () => {
        try {
          await subscriber.unsubscribe(channel);
          await subscriber.quit();
        } catch {
          // Ignore cleanup errors
        }
        try {
          controller.close();
        } catch {
          // Stream might already be closed
        }
      };

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

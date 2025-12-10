import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { aiRequestQueue } from "@/lib/redis";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // *Create authenticated Convex client with Clerk token
    const authHeader = req.headers.get("authorization");
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    
    // Set the auth token from the request headers
    if (authHeader) {
      convex.setAuth(authHeader);
    }

    const body = await req.json();
    const { conversationId, messageId, models, userMessage } = body;

    // *Get user from Convex
    const user = await convex.query(api.users.getCurrentUser);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // *Verify plan limits
    const stats = await convex.query(api.users.getUserStats);
    if (!stats) {
      return NextResponse.json({ error: "Could not fetch user stats" }, { status: 500 });
    }

    const limit = user.plan === "pro" ? 10000 : 0; //? FREE = 0 requests
    
    if (stats.usage.requests >= limit) {
      return NextResponse.json(
        { 
          error: user.plan === "free" 
            ? "Free tier does not include messages. Configure your API keys in Settings." 
            : "You have reached your monthly limit"
        },
        { status: 403 }
      );
    }

    // *Obtain user record 
    const userRecord = await convex.query(api.users.getUserByClerkId, { clerkId: userId });
    if (!userRecord) {
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    // *For each model, enqueue a job
    const jobs = await Promise.all(
      models.map(async (model: { modelId: string; subModelId: string }) => {
        // *Get user API key (REQUIRED in free tier)
        const apiKey = await getUserApiKeyForModel(userId, model.modelId);
        
        if (!apiKey && user.plan === "free") {
          throw new Error(
            `No tienes configurada una API key para ${model.modelId}. Ve a Configuración.`
          );
        }

        // *If PRO and no key, use the system key
        const finalApiKey = apiKey || getSystemApiKey(model.modelId);

        // *Create a job in the queue
        const job = await aiRequestQueue.add(
          `${model.modelId}-${model.subModelId}`,
          {
            responseId: body.responseIds[models.indexOf(model)],
            conversationId,
            userId: userRecord._id,
            messageId,
            modelId: model.modelId,
            subModelId: model.subModelId,
            userMessage,
            apiKey: finalApiKey,
            timestamp: Date.now(),
          },
          {
            jobId: `${messageId}-${model.modelId}-${Date.now()}`,
            priority: user.plan === "pro" ? 1 : 2, // !PRO has priority
          }
        );

        return {
          jobId: job.id,
          modelId: model.modelId,
          responseId: body.responseIds[models.indexOf(model)],
        };
      })
    );

    return NextResponse.json({
      success: true,
      jobs,
      message: "Requests queued successfully",
    });

  } catch (error) {
    console.error("AI Gateway error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

// *Helpers
async function getUserApiKeyForModel(
  userId: string,
  modelId: string
): Promise<string | null> {
  const { getUserApiKey } = await import("@/lib/aws-secrets");
  return getUserApiKey(userId, modelId);
}

function getSystemApiKey(modelId: string): string {
  const envVar = `${modelId.toUpperCase()}_API_KEY`;
  const key = process.env[envVar];
  
  if (!key) {
    throw new Error(
      `Sistema no tiene API key configurada para ${modelId}. Por favor configura tu propia key.`
    );
  }
  
  return key;
}
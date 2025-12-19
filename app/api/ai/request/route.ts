import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { aiRequestQueue } from "@/lib/redis";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * Creates an authenticated ConvexHttpClient with the user's auth token
 */
async function getAuthenticatedConvexClient(): Promise<ConvexHttpClient> {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  
  // Get the auth session and token from Clerk
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  
  if (token) {
    convex.setAuth(token);
  }
  
  return convex;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, messageId, models, userMessage } = body;

    // *Get user from Convex
    const convex = await getAuthenticatedConvexClient();
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
    
    // Only enforce limit for PRO users (who use system keys)
    // Free users are gated by the "must have own key" check later
    if (user.plan === "pro" && stats.usage.requests >= limit) {
      return NextResponse.json(
        { 
          error: "You have reached your monthly limit"
        },
        { status: 403 }
      );
    }

    // *Obtain user record 
    const userRecord = await convex.query(api.users.getUserByClerkId, { clerkId: userId });
    if (!userRecord) {
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    // *Extract specialized models from request
    // Models come with specializedModels array containing IDs of image/video models
    const { SPECIALIZED_MODELS } = await import("@/shared/AiModelList");
    
    // *For each reasoning model, enqueue a job
    const jobs = await Promise.all(
      models.map(async (model: { modelId: string; provider: string; subModelId: string; specializedModels?: string[] }, index: number) => {
        console.log(`[Request] Processing model ${model.modelId} (Provider: ${model.provider})...`);
        
        // *Extract specialized models for THIS specific model
        const currentSpecializedModelsData = (model.specializedModels || [])
          .map((modelId: string) => {
            const modelDef = SPECIALIZED_MODELS.find(sm => sm.id === modelId);
            if (!modelDef) return null;
            
            return {
              type: modelDef.category,
              modelId: modelDef.id,
              providerModelId: modelDef.providerModelId,
              modelName: modelDef.name,
              provider: modelDef.provider,
            };
          })
          .filter((m): m is NonNullable<typeof m> => m !== null);

        // *Get user API key (REQUIRED in free tier)
        console.log(`[Request] Fetching API key for ${model.provider}...`);
        const apiKey = await getUserApiKeyForModel(userId, model.provider);
        console.log(`[Request] API key fetched for ${model.provider} (found: ${!!apiKey})`);
        
        if (!apiKey && user.plan === "free") {
          throw new Error(
            `No tienes configurada una API key para ${model.provider}. Ve a Configuración.`
          );
        }

        // *If PRO and no key, use the system key
        const finalApiKey = apiKey || getSystemApiKey(model.provider);

        // *Create a job in the queue
        console.log(`[Request] Adding job to queue for ${model.modelId}...`);
        const job = await aiRequestQueue.add(
          `${model.modelId}-${model.subModelId}`,
          {
            responseId: body.responseIds[index],
            conversationId,
            userId: userRecord._id,
            messageId,
            modelId: model.modelId,
            subModelId: model.subModelId,
            userMessage,
            apiKey: finalApiKey,
            timestamp: Date.now(),
            // Pass specialized models for orchestration
            specializedModels: currentSpecializedModelsData.length > 0 
              ? currentSpecializedModelsData 
              : undefined,
          },
          {
            jobId: `${messageId}-${model.modelId}-${Date.now()}`,
            priority: user.plan === "pro" ? 1 : 2, // !PRO has priority
          }
        );
        console.log(`[Request] Job added for ${model.modelId}, ID: ${job.id}`);

        return {
          jobId: job.id,
          modelId: model.modelId,
          responseId: body.responseIds[index],
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

// TODO: Implement actual AWS Secrets Manager integration
async function getUserApiKeyForModel(
  userId: string,
  modelId: string
): Promise<string | null> {
  const { getUserApiKey } = await import("@/lib/aws-secrets");
  // TODO: Implement AWS Secrets Manager integration
  // For now, return null to use system keys
  return getUserApiKey(userId, modelId); 
}

function getSystemApiKey(modelId: string): string {

  const envVarMap: Record<string, string> = {
    "GPT": "OPENAI_API_KEY",
    "Claude": "ANTHROPIC_API_KEY",
    "Gemini": "GOOGLE_AI_API_KEY",
    "Grok": "XAI_API_KEY",
    "DeepSeek": "DEEPSEEK_API_KEY",
  };

  const envVarName = envVarMap[modelId];
  
  if (!envVarName) {
    throw new Error(
      `Modelo desconocido: ${modelId}. Modelos soportados: ${Object.keys(envVarMap).join(", ")}`
    );
  }

  const key = process.env[envVarName];
  
  if (!key) {
    throw new Error(
      `Sistema no tiene API key configurada para ${modelId}. Variable esperada: ${envVarName}`
    );
  }
  
  return key;
}
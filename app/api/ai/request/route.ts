import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sendToQueue } from "@/lib/sqs";
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
    const { SPECIALIZED_MODELS } = await import("@/shared/AiModelList");
    
    // *For each reasoning model, send to SQS
    const jobs = await Promise.all(
      models.map(async (model: { modelId: string; provider: string; providerModelId: string; specializedModels?: string[] }, index: number) => {
        console.log(`[Request] Processing model ${model.modelId} (Provider: ${model.provider})...`);
        
        // *Extract specialized models for THIS specific model
        const currentSpecializedModelsData = (model.specializedModels || [])
          .map((modelId: string) => {
            const modelDef = SPECIALIZED_MODELS.find(sm => sm.id === modelId);
            if (!modelDef) return null;
            
            return {
              type: modelDef.category === 'image' ? 'image' as const : 'video' as const,
              modelId: modelDef.id,
              providerModelId: modelDef.providerModelId,
              modelName: modelDef.name,
              provider: modelDef.provider,
            };
          })
          .filter(Boolean);

        // *Get user API key (REQUIRED in free tier)
        const apiKey = await getUserApiKeyForModel(userId, model.provider);
        
        if (!apiKey && user.plan === "free") {
          throw new Error(
            `No tienes configurada una API key para ${model.provider}. Ve a Configuración.`
          );
        }

        // *If PRO and no key, use the system key
        const finalApiKey = apiKey || getSystemApiKey(model.provider);

        // *Send message to SQS
        const queueUrl = user.plan === "pro" 
          ? process.env.SQS_QUEUE_URL_PRO! 
          : process.env.SQS_QUEUE_URL_FREE!;

        console.log(`[Request] Sending message to SQS for ${model.modelId} (Provider: ${model.provider})...`);
        
        const messageBody = {
          responseId: body.responseIds[index],
          conversationId,
          userId: userRecord._id,
          messageId,
          modelId: model.modelId,
          provider: model.provider,
          subModelId: model.providerModelId,
          userMessage,
          apiKey: finalApiKey,
          timestamp: Date.now(),
          specializedModels: currentSpecializedModelsData.length > 0 
            ? currentSpecializedModelsData 
            : undefined,
        };

        const sqsResponse = await sendToQueue(queueUrl, messageBody, conversationId);
        
        return {
          jobId: sqsResponse.messageId,
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

async function getUserApiKeyForModel(
  userId: string,
  modelId: string
): Promise<string | null> {
  const { getUserApiKey } = await import("@/lib/aws-secrets");
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
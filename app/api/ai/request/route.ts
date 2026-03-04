import { auth } from "@clerk/nextjs/server";
import { sendToQueue } from "@/lib/aws/sqs";
import { api } from "@/convex/_generated/api";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getConvexClient } from "@/lib/convex-client";
import { checkRateLimit } from "@/lib/rate-limit";

async function getAuthenticatedConvexClient() {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  return getConvexClient(token ?? undefined);
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }
    const rl = await checkRateLimit(userId, "ai-request");
    if (!rl.success) {
      return apiError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
    }

    const body = await req.json();
    const { conversationId, messageId, models, userMessage } = body;

    // *Get user from Convex
    const convex = await getAuthenticatedConvexClient();
    const user = await convex.query(api.users.users.getCurrentUser);
    if (!user) {
      return apiError("User not found", 404, "USER_NOT_FOUND");
    }

    // *Verify plan limits
    const stats = await convex.query(api.users.users.getUserStats);
    if (!stats) {
      return apiError("Could not fetch user stats", 500, "INTERNAL_ERROR");
    }

    const limit = user.plan === "pro" || user.plan === "payg" ? 10000 : 0; // starter = 0 requests (must use API key or upgrade)

    // Only enforce limit for PRO/PAYG users (who can use system keys)
    if ((user.plan === "pro" || user.plan === "payg") && stats.usage.requests >= limit) {
      return apiError("You have reached your monthly limit", 403, "RATE_LIMIT_EXCEEDED");
    }

    // *Obtain user record
    const userRecord = await convex.query(api.users.users.getUserByClerkId, { clerkId: userId });
    if (!userRecord) {
      return apiError("User record not found", 404, "USER_NOT_FOUND");
    }

    if (user.plan === "pro" || user.plan === "payg" || user.plan === "starter" || user.plan === "free") {
      if ((user.balanceCredits ?? 0) <= 0) {
        return apiError("Añade créditos para continuar usando la plataforma.", 402, "INSUFFICIENT_CREDITS");
      }
    }

    // *Extract specialized models from request using model registry
    const { modelRegistry } = await import("@/shared/ai");

    // *For each reasoning model, send to SQS
    const jobs = await Promise.all(
      models.map(async (model: { modelId: string; provider: string; providerModelId: string; specializedModels?: string[] }, index: number) => {
        console.log(`[Request] Processing model ${model.modelId} (Provider: ${model.provider})...`);

        // *Extract specialized models for THIS specific model using registry
        const currentSpecializedModelsData = (model.specializedModels || [])
          .map((modelId: string) => {
            const modelDef = modelRegistry.getById(modelId);
            if (!modelDef) return null;

            const isImage = modelDef.primaryCapability === 'image.generation';
            return {
              type: isImage ? 'image' as const : 'video' as const,
              modelId: modelDef.id,
              providerModelId: modelDef.providerModelId,
              modelName: modelDef.displayName,
              provider: modelDef.provider,
            };
          })
          .filter(Boolean);

        // *Get user API key (REQUIRED in free tier)
        const apiKey = await getUserApiKeyForModel(userId, model.provider);
        
        if (!apiKey && (user.plan === "free" || user.plan === "starter")) {
          throw new Error(
            `No tienes configurada una API key para ${model.provider}. Ve a Configuración.`
          );
        }

        // *If PRO and no key, use the system key
        const finalApiKey = apiKey || getSystemApiKey(model.provider);

        // *Send message to SQS
        const queueUrl = (user.plan === "pro" || user.plan === "payg")
          ? process.env.SQS_QUEUE_URL_PRO!
          : process.env.SQS_QUEUE_URL_FREE!;

        console.log(`[Request] Sending message to SQS for ${model.modelId} (Provider: ${model.provider})...`);

        // Nombre que se muestra = columna Name (lo que la persona eligió en onboarding)
        const displayNameForAi = user.name?.trim() || user.onboardingDisplayName?.trim();
        const onboardingContext =
          displayNameForAi || (user.onboardingInterests?.length ?? 0) > 0
            ? {
                displayName: displayNameForAi || undefined,
                interests: user.onboardingInterests ?? undefined,
              }
            : undefined;

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
          ...(onboardingContext && { onboardingContext }),
        };

        const sqsResponse = await sendToQueue(queueUrl, messageBody, conversationId);
        
        return {
          jobId: sqsResponse.messageId,
          modelId: model.modelId,
          responseId: body.responseIds[index],
        };
      })
    );

    return apiSuccess({ jobs }, { message: "Requests queued successfully" });

  } catch (error) {
    console.error("AI Gateway error:", error);
    return apiError(error instanceof Error ? error.message : "Internal error", 500, "INTERNAL_ERROR");
  }
}

// *Helpers

async function getUserApiKeyForModel(
  userId: string,
  modelId: string
): Promise<string | null> {
  const { getUserApiKey } = await import("@/lib/aws/aws-secrets");
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
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { streamText, LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const runtime = "edge";

export async function POST(req: Request) {
    try {
        const { userId, getToken } = await auth();
        
        // Create authenticated Convex client
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        const token = await getToken({ template: "convex" });
        if (token) {
            convex.setAuth(token);
        }
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            responseId,
            modelId, // This is the specific model ID (e.g., gpt-5-nano)
            provider, // This is the provider name (e.g., GPT)
            subModelId, // This is the provider's model ID (e.g., gpt-5-nano)
            userMessage,
        } = body;

        // Use provider for configuration, modelId for logging
        const targetProvider = provider || modelId;

        console.log(`Starting stream for ${modelId} (Provider: ${targetProvider})`);

        // Upgrade the status to "processing"
        await convex.action(api.actions.updateResponseStatus, {
            responseId: responseId as Id<"modelResponses">,
            status: "processing",
        });

        const startTime = Date.now();
        let model: LanguageModel;

        // *Get user API key (REQUIRED in free tier)
        const apiKey = await getUserApiKeyForModel(userId, targetProvider);
        
        // *If PRO and no key, use the system key
        const finalApiKey = apiKey || getSystemApiKey(targetProvider);

        if (!finalApiKey || typeof finalApiKey !== 'string' || finalApiKey.trim() === '') {
            return NextResponse.json({ error: "Invalid API Key" }, { status: 400 });
        }

        // Configure provider based on targetProvider
        switch (targetProvider) {
            case "GPT": {
                const openai = createOpenAI({
                    apiKey: finalApiKey,
                });
                model = openai(subModelId);
                break;
            }
            
            case "Claude": {
                const anthropic = createAnthropic({
                    apiKey: finalApiKey,
                });
                model = anthropic(subModelId);
                break;
            }
            
            case "Gemini": {
                const google = createGoogleGenerativeAI({
                    apiKey: finalApiKey,
                });
                model = google(subModelId);
                break;
            }
            
            case "Grok": {
                const xai = createOpenAI({
                    apiKey: finalApiKey,
                    baseURL: "https://api.x.ai/v1",
                });
                model = xai(subModelId);
                break;
            }
            
            case "DeepSeek": {
                const deepseek = createOpenAI({
                    apiKey: finalApiKey,
                    baseURL: "https://api.deepseek.com/v1",
                });
                model = deepseek(subModelId);
                break;
            }
            
            default:
                throw new Error(`Streaming not supported for ${targetProvider}`);
        }

        const isReasoningModel = (model: any) => {
            if (typeof model !== 'string') return false;
            return model.startsWith('o1') || model.startsWith('o3') || model.includes('gpt-5');
        };

        // Build messages with system prompt for orchestration if needed
        const messages = [
            { 
                role: "system" as const, 
                content: `You are an AI orchestrator. Your primary job is to decide if the user's request requires specialized tools (image or video generation). 

RULES:
1. If the user asks for an image, illustration, or visual content, you MUST call 'generate_image'.
2. If the user asks for a video or animation, you MUST call 'generate_video'.
3. DO NOT provide the image prompt in your text response.
4. DO NOT provide SVG code or any other code in your text response.
5. Keep your text response extremely brief (e.g., "Generating your image...").
6. If you call a tool, your text response should NOT contain the prompt you sent to the tool.`
            },
            { role: "user" as const, content: userMessage }
        ];

        const result = streamText({
            model: model,
            messages: messages,
            temperature: isReasoningModel(subModelId) ? undefined : 0.7,
            onFinish: async ({ text, usage }) => {
                try {
                    const responseTime = (Date.now() - startTime) / 1000;
                    const tokenCount = usage.totalTokens ?? 0;
                    
                    console.log(`Stream completed for ${modelId} - ${responseTime} seconds`);

                    // Storage in convex - ONLY update content, don't mark as completed if it's an orchestrator
                    // The worker will handle the final completion for orchestrators
                    await convex.action(api.actions.updateResponseCompleted, {
                        responseId: responseId as Id<"modelResponses">,
                        content: text || "Generando respuesta...",
                        status: "processing", // Keep as processing so worker can finish
                        responseTime,
                        tokens: tokenCount,
                        cost: calculateCost(modelId, subModelId, tokenCount)
                    });
                } catch (error) {
                    console.error("Failed to update response completion:", error);
                }
            },
        });

        return result.toTextStreamResponse();

    } catch (error) {
        console.error("Streaming error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Streaming failed" },
            { status: 500 }
        );
    }
}

// Temporal helper for calculate cost 
// TODO: Move to lib/pricing.ts
function calculateCost(modelId: string, subModelId: string, tokens: number): number {
    const pricing: Record<string, Record<string, number>> = {
        "GPT": {
            "gpt-4o": 0.005 / 1000, // $5 per 1M input tokens
            "gpt-4o-mini": 0.00015 / 1000, // $0.15 per 1M input tokens
            "gpt-4-turbo": 0.01 / 1000,
            "gpt-3.5-turbo": 0.0005 / 1000,
        },
        "Claude": {
            "claude-opus-4-5-20251101": 0.015 / 1000,
            "claude-sonnet-4-5-20250929": 0.003 / 1000,
            "claude-haiku-4-5-20251001": 0.0008 / 1000,
            "claude-3-opus-20240229": 0.015 / 1000,
            "claude-3-sonnet-20240229": 0.003 / 1000,
        },
        "Gemini": {
            "gemini-2.0-flash-exp": 0, // Free tier
            "gemini-1.5-pro": 0.00125 / 1000,
            "gemini-1.5-flash": 0.000075 / 1000,
        },
        "Grok": {
            "grok-beta": 0.005 / 1000,
            "grok-2-latest": 0.005 / 1000,
        },
        "DeepSeek": {
            "deepseek-chat": 0.00014 / 1000, // $0.14 per 1M tokens
            "deepseek-coder": 0.00014 / 1000,
        }
    };
    
    return tokens * (pricing[modelId]?.[subModelId] ?? 0.001);
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
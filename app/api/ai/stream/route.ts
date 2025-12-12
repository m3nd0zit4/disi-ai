import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { streamText, LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const runtime = "edge";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            responseId,
            modelId,
            subModelId,
            userMessage,
            apiKey,
        } = body;

        console.log(`Starting stream for ${modelId}/${subModelId}`);

        // Upgrade the status to "processing"
        await convex.action(api.actions.updateResponseStatus, {
            responseId: responseId as Id<"modelResponses">,
            status: "processing",
        });

        const startTime = Date.now();
        let model: LanguageModel;

        // Configure provider based on modelId and apiKey
        if (modelId === "GPT") {
            const openai = createOpenAI({
                apiKey: apiKey,
            });
            model = openai(subModelId);
        } else if (modelId === "Claude") {
            const anthropic = createAnthropic({
                apiKey: apiKey,
            });
            model = anthropic(subModelId);
        } else {
            throw new Error(`Streaming not supported for ${modelId}`);
        }

        const result = streamText({
            model: model,
            messages: [{ role: "user", content: userMessage }],
            temperature: 0.7,
            onFinish: async ({ text, usage }) => {
                try {
                    const responseTime = (Date.now() - startTime) / 1000;
                    const tokenCount = usage.totalTokens ?? 0;
                    
                    console.log(`Stream completed for ${modelId} - ${responseTime} seconds`);

                    // Storage in convex
                    await convex.action(api.actions.updateResponseCompleted, {
                        responseId: responseId as Id<"modelResponses">,
                        content: text,
                        status: "completed",
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
        console.error("Streaming error: ", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Streaming failed" },
            { status: 500 }
        );
    }
}

// Temporal helper for calculate cost 
// TODO: Hardcoded prices in lib/pricing.ts

function calculateCost(modelId: string, subModelId: string, tokens: number): number {
    const pricing: Record<string, Record<string, number>> = {
        "GPT": {
            "gpt-4o": 0.03 / 1000,
            "gpt-4o-mini": 0.001 / 1000,
        },
        "Claude": {
            "claude-3-sonnet-20240229": 0.003 / 1000,
            "claude-3-opus-20240229": 0.015 / 1000,
        }
    };
    
    return tokens * (pricing[modelId]?.[subModelId] ?? 0.001);
}
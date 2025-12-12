import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserApiKey } from "@/lib/aws-secrets";

//* Endpoint to get API key for a user
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { provider } = await req.json();

    // Get user API key
    const apiKey = await getUserApiKey(userId, provider);

    // If no key, use system key
    if (!apiKey) {
      const systemKey = getSystemApiKey(provider);
      return NextResponse.json({ apiKey: systemKey, source: "system" });
    }

    return NextResponse.json({ apiKey, source: "user" });

  } catch (error) {
    console.error("Error getting API key:", error);
    return NextResponse.json(
      { error: "Failed to get API key" },
      { status: 500 }
    );
  }
}

function getSystemApiKey(provider: string): string {
  const envVarMap: Record<string, string> = {
    "GPT": "OPENAI_API_KEY",
    "Claude": "ANTHROPIC_API_KEY",
    "Gemini": "GOOGLE_AI_API_KEY",
    "Grok": "XAI_API_KEY",
    "DeepSeek": "DEEPSEEK_API_KEY",
  };

  const envVarName = envVarMap[provider];
  if (!envVarName) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const key = process.env[envVarName];
  if (!key) {
    throw new Error(`System API key not configured for ${provider}`);
  }

  return key;
}

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { storeUserApiKey, deleteUserApiKey, validateApiKey } from "@/lib/aws-secrets";
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

// GET - Obtain user API keys
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = await getAuthenticatedConvexClient();
    const keys = await convex.query(api.users.getUserApiKeys);

    return NextResponse.json({ keys });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// POST - Save API key
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Provider and apiKey are required" },
        { status: 400 }
      );
    }

    // Validate API key
    console.log(` Validating API key for ${provider}...`);
    const validation = await validateApiKey(provider, apiKey);

    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: `Invalid API key for ${provider}`, 
          details: validation.error 
        },
        { status: 400 }
      );
    }

    console.log(` API key validated for ${provider}`);

    // Save in AWS Secrets Manager
    const secretName = await storeUserApiKey(userId, provider, apiKey);

    // Register in Convex with authenticated client
    const convex = await getAuthenticatedConvexClient();
    await convex.mutation(api.users.saveApiKey, {
      clerkId: userId,
      provider,
      secretName,
      isValid: true,
    });

    return NextResponse.json({
      success: true,
      message: `API key for ${provider} saved successfully`,
      provider,
    });

  } catch (error) {
    console.error("Error saving API key:", error);
    return NextResponse.json(
      { 
        error: "Failed to save API key",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete API key
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    // Delete from AWS
    await deleteUserApiKey(userId, provider);

    // Delete from Convex with authenticated client
    const convex = await getAuthenticatedConvexClient();
    await convex.mutation(api.users.deleteApiKey, {
      clerkId: userId,
      provider,
    });

    return NextResponse.json({
      success: true,
      message: `API key for ${provider} deleted successfully`,
    });

  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}
import { auth } from "@clerk/nextjs/server";
import { storeUserApiKey, deleteUserApiKey, validateApiKey } from "@/lib/aws/aws-secrets";
import { api } from "@/convex/_generated/api";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getConvexClient } from "@/lib/convex-client";

async function getAuthenticatedConvexClient() {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  return getConvexClient(token ?? undefined);
}

// GET - Obtain user API keys
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const convex = await getAuthenticatedConvexClient();
    const keys = await convex.query(api.users.users.getUserApiKeys);

    return apiSuccess({ keys });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return apiError("Failed to fetch API keys", 500, "INTERNAL_ERROR");
  }
}

// POST - Save API key
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await req.json();
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return apiError("Provider and apiKey are required", 400, "INVALID_INPUT");
    }

    // Validate API key
    console.log(` Validating API key for ${provider}...`);
    const validation = await validateApiKey(provider, apiKey);

    if (!validation.valid) {
      return apiError(`Invalid API key for ${provider}: ${validation.error ?? "validation failed"}`, 400, "INVALID_INPUT");
    }

    console.log(` API key validated for ${provider}`);

    // Save in AWS Secrets Manager
    const secretName = await storeUserApiKey(userId, provider, apiKey);

    // Register in Convex with authenticated client
    const convex = await getAuthenticatedConvexClient();
    await convex.mutation(api.users.users.saveApiKey, {
      clerkId: userId,
      provider,
      secretName,
      isValid: true,
    });

    return apiSuccess(
      { provider },
      { message: `API key for ${provider} saved successfully` }
    );
  } catch (error) {
    console.error("Error saving API key:", error);
    return apiError(error instanceof Error ? error.message : "Failed to save API key", 500, "INTERNAL_ERROR");
  }
}

// DELETE - Delete API key
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return apiError("Provider is required", 400, "INVALID_INPUT");
    }

    // Delete from AWS
    await deleteUserApiKey(userId, provider);

    // Delete from Convex with authenticated client
    const convex = await getAuthenticatedConvexClient();
    await convex.mutation(api.users.users.deleteApiKey, {
      clerkId: userId,
      provider,
    });

    return apiSuccess(
      { provider },
      { message: `API key for ${provider} deleted successfully` }
    );
  } catch (error) {
    console.error("Error deleting API key:", error);
    return apiError("Failed to delete API key", 500, "INTERNAL_ERROR");
  }
}
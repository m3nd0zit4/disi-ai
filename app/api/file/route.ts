import { NextResponse } from "next/server";
import { generatePresignedDownloadUrl } from "@/lib/aws/s3";
import { auth } from "@clerk/nextjs/server";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const shouldRedirect = searchParams.get("redirect") === "true";

    if (!key) {
      return apiError("Missing key", 400, "INVALID_INPUT");
    }

    // Verify ownership: S3 keys are formatted as userId/uuid-filename
    const keyParts = key.split("/");
    if (keyParts.length < 2) {
      return apiError("Invalid key format", 400, "INVALID_INPUT");
    }

    const fileOwnerId = keyParts[0];
    if (fileOwnerId !== userId && fileOwnerId !== "generated") {
      return apiError("Unauthorized access to file", 403, "FORBIDDEN");
    }

    const url = await generatePresignedDownloadUrl(key);

    if (shouldRedirect) {
      return NextResponse.redirect(url);
    }

    return apiSuccess({ url });
  } catch (error) {
    console.error("Error generating download URL:", error);
    return apiError("Internal Server Error", 500, "INTERNAL_ERROR");
  }
}

import { generatePresignedUploadUrl } from "@/lib/aws/s3";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@clerk/nextjs/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }
    const rl = await checkRateLimit(userId, "upload");
    if (!rl.success) {
      return apiError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
    }

    const { contentType, fileName, s3Key: providedS3Key } = await req.json();

    // Validate contentType - whitelist of allowed MIME types
    const allowedMimeTypes = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml",
      "application/pdf",
      "text/plain", "text/markdown", "text/csv",
      "application/json", "application/xml",
      "application/javascript", "application/typescript",
      "text/html", "text/css",
    ];

    if (!contentType || typeof contentType !== "string" || contentType.trim() === "") {
      return apiError("Invalid or missing contentType", 400, "INVALID_INPUT");
    }

    if (!allowedMimeTypes.includes(contentType) && !contentType.startsWith("text/")) {
      return apiError("File type not allowed", 400, "INVALID_INPUT");
    }

    // Validate and sanitize fileName
    if (!fileName || typeof fileName !== "string" || fileName.trim() === "") {
      return apiError("Invalid or missing fileName", 400, "INVALID_INPUT");
    }

    // Sanitize filename: remove control characters, path separators, and limit length
    const sanitizedFileName = fileName
      .replace(/\p{Cc}/gu, "") // Remove control characters
      .replace(/[\\\/]/g, "") // Remove path separators
      .replace(/\.\./g, "") // Remove directory traversal
      .trim()
      .slice(0, 255); // Limit to 255 characters

    if (sanitizedFileName.length === 0) {
      return apiError("Invalid fileName after sanitization", 400, "INVALID_INPUT");
    }

    let uniqueKey: string;
    if (providedS3Key) {
      if (typeof providedS3Key !== "string") {
        return apiError("Invalid s3Key format", 400, "INVALID_INPUT");
      }
      const normalized = providedS3Key.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
      if (
        normalized.includes("..") ||
        normalized.includes("\\") ||
        !normalized.startsWith(`${userId}/`)
      ) {
        return apiError("Invalid s3Key format", 403, "FORBIDDEN");
      }
      uniqueKey = normalized;
    } else {
      uniqueKey = `${userId}/${uuidv4()}-${sanitizedFileName}`;
    }

    const url = await generatePresignedUploadUrl(uniqueKey, contentType);

    return apiSuccess({ url, key: uniqueKey });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    return apiError("Internal Server Error", 500, "INTERNAL_ERROR");
  }
}

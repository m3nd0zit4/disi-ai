import { NextResponse } from "next/server";
import { generatePresignedUploadUrl } from "@/lib/s3";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: "Invalid or missing contentType" }, { status: 400 });
    }

    if (!allowedMimeTypes.includes(contentType) && !contentType.startsWith("text/")) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    // Validate and sanitize fileName
    if (!fileName || typeof fileName !== "string" || fileName.trim() === "") {
      return NextResponse.json({ error: "Invalid or missing fileName" }, { status: 400 });
    }

    // Sanitize filename: remove control characters, path separators, and limit length
    const sanitizedFileName = fileName
      .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
      .replace(/[\\\/]/g, "") // Remove path separators
      .replace(/\.\./g, "") // Remove directory traversal
      .trim()
      .slice(0, 255); // Limit to 255 characters

    if (sanitizedFileName.length === 0) {
      return NextResponse.json({ error: "Invalid fileName after sanitization" }, { status: 400 });
    }
    
    // Use provided s3Key (from Convex) or create a unique key
    const uniqueKey = providedS3Key || `${userId}/${uuidv4()}-${sanitizedFileName}`;
    
    const url = await generatePresignedUploadUrl(uniqueKey, contentType);
    
    return NextResponse.json({ url, key: uniqueKey });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

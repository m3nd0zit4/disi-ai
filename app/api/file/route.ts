import { NextResponse } from "next/server";
import { generatePresignedDownloadUrl } from "@/lib/s3";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const shouldRedirect = searchParams.get("redirect") === "true";

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // Verify ownership: S3 keys are formatted as userId/uuid-filename
    const keyParts = key.split("/");
    if (keyParts.length < 2) {
      return NextResponse.json({ error: "Invalid key format" }, { status: 400 });
    }

    const fileOwnerId = keyParts[0];
    if (fileOwnerId !== userId && fileOwnerId !== "generated") {
      return NextResponse.json({ error: "Unauthorized access to file" }, { status: 403 });
    }
    
    const url = await generatePresignedDownloadUrl(key);
    
    if (shouldRedirect) {
      return NextResponse.redirect(url);
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

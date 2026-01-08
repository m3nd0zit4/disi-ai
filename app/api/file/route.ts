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

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // Optional: Add logic to verify user has access to this key
    // For now, we assume if they have the key and are logged in, they can read it.
    
    const url = await generatePresignedDownloadUrl(key);
    
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

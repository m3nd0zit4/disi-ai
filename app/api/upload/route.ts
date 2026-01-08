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

    const { contentType, fileName } = await req.json();
    
    // Create a unique key: userId/uuid-filename to avoid collisions and organize by user
    const uniqueKey = `${userId}/${uuidv4()}-${fileName}`;
    
    const url = await generatePresignedUploadUrl(uniqueKey, contentType);
    
    return NextResponse.json({ url, key: uniqueKey });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

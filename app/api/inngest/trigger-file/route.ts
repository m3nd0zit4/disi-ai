import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

const FILE_WORKER_SECRET = process.env.FILE_WORKER_SECRET;

/**
 * Called by Convex confirmUpload action to emit file/process to Inngest.
 * Body: { fileId, s3Key, fileName, kbId?, secret }
 */
export async function POST(req: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4c7c2d42-9d2e-477e-b3c1-2cc3f24648cb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'trigger-file/route.ts:POST',message:'trigger-file POST entry',data:{hasSecret:!!FILE_WORKER_SECRET},timestamp:Date.now(),hypothesisId:'H2,H3,H5'})}).catch(()=>{});
  // #endregion
  if (!FILE_WORKER_SECRET) {
    return NextResponse.json({ error: "Trigger not configured" }, { status: 503 });
  }
  let body: { fileId: string; s3Key: string; fileName: string; kbId?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.secret !== FILE_WORKER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { fileId, s3Key, fileName, kbId } = body;
  if (!fileId || !s3Key || !fileName) {
    return NextResponse.json({ error: "Missing fileId, s3Key, or fileName" }, { status: 400 });
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4c7c2d42-9d2e-477e-b3c1-2cc3f24648cb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'trigger-file/route.ts:beforeSend',message:'calling inngest.send',data:{fileId,s3Key: s3Key?.slice?.(0,40),fileName},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  await inngest.send({
    name: "file/process",
    data: { fileId, s3Key, fileName, kbId },
  });
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4c7c2d42-9d2e-477e-b3c1-2cc3f24648cb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'trigger-file/route.ts:afterSend',message:'inngest.send completed',data:{fileId},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  return NextResponse.json({ ok: true });
}

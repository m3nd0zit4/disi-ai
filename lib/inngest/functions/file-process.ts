import { inngest } from "@/lib/inngest/client";
import { runFileProcessWithErrorHandling } from "@/lib/worker/process-file";
import type { FileProcessPayload } from "@/lib/worker/process-file";

export const fileProcessTask = inngest.createFunction(
  {
    id: "file-process",
    retries: 2,
  },
  { event: "file/process" },
  async ({ event }) => {
    const data = event.data as FileProcessPayload;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4c7c2d42-9d2e-477e-b3c1-2cc3f24648cb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'file-process.ts:handler',message:'file/process event received',data:{fileId:data?.fileId,s3Key:data?.s3Key?.slice?.(0,40)},timestamp:Date.now(),hypothesisId:'H3,H4'})}).catch(()=>{});
    // #endregion
    try {
      await runFileProcessWithErrorHandling(data);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4c7c2d42-9d2e-477e-b3c1-2cc3f24648cb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'file-process.ts:handlerDone',message:'runFileProcessWithErrorHandling completed',data:{fileId:data?.fileId},timestamp:Date.now(),hypothesisId:'H4',runId:'post-fix'})}).catch(()=>{});
      // #endregion
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4c7c2d42-9d2e-477e-b3c1-2cc3f24648cb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'file-process.ts:handlerError',message:'runFileProcessWithErrorHandling failed',data:{fileId:data?.fileId,error:String(err)},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      throw err;
    }
  }
);

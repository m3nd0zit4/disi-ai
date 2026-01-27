import { config } from "dotenv";
import { resolve } from "path";

// Load env vars
config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  console.log("[Ingest Worker] 🏁 Initializing...");

  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("../convex/_generated/api");
  
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  
  // TODO: Initialize SQS Consumer or Polling
  
  console.log("[Ingest Worker] ✅ Ready to process files.");
  
  // Mock loop
  while (true) {
    // Poll for pending files (fallback if no SQS)
    // const pending = await convex.action(api.files.publicGetPendingFiles, { secret: ... });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

main().catch(console.error);

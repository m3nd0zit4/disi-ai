import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

console.log("[File Worker] Polling is disabled. File processing runs via Inngest (file/process).");
console.log("[File Worker] Trigger: Convex confirmUpload -> POST /api/inngest/trigger-file. Exiting.");
process.exit(0);

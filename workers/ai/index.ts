import { config } from "dotenv";
import { resolve } from "path";
import { appendFileSync, mkdirSync } from "fs";

// Load environment variables BEFORE any other worker code runs.
// In ES modules, static imports are hoisted and run first, so if we import
// ./runner here, shared.ts would load before config() runs and
// NEXT_PUBLIC_CONVEX_URL would be undefined. Use dynamic import after config().
config({ path: resolve(process.cwd(), ".env.local") });

// #region agent log
const DEBUG_LOG = resolve(process.cwd(), ".cursor", "debug.log");
function agentLog(payload: Record<string, unknown>) {
  const line = JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: "debug-session" }) + "\n";
  try { try { mkdirSync(resolve(process.cwd(), ".cursor"), { recursive: true }); } catch (_) {} appendFileSync(DEBUG_LOG, line); } catch (_) {}
  fetch('http://127.0.0.1:7242/ingest/4c7c2d42-9d2e-477e-b3c1-2cc3f24648cb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
}
agentLog({location:'workers/ai/index.ts:entry',message:'AI worker index.ts loaded, env loaded, about to dynamic import runner',data:{cwd:process.cwd(),hasConvexUrl:!!process.env.NEXT_PUBLIC_CONVEX_URL},hypothesisId:'H1'});
// #endregion

// Polling removed: canvas execution is now driven by Inngest (canvas/execute.task).
// Run Next.js (npm run dev) and Inngest handles tasks via app/api/inngest/route.ts.
(async () => {
  console.log("[AI Worker] Polling is disabled. Processing runs via Inngest (Next.js). Exiting.");
  agentLog({ location: "workers/ai/index.ts", message: "polling disabled, exiting", hypothesisId: "H1" });
  process.exit(0);
})();

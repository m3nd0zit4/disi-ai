/**
 * Quick Gemini Models Verification (Low Cost)
 * Tests connectivity to Gemini models without using many tokens
 */

import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { GoogleGenerativeAI } from "@google/generative-ai";

const MODELS_TO_TEST = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-2.5-flash-lite",
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
];

async function testModel(client: GoogleGenerativeAI, modelId: string): Promise<void> {
  try {
    const model = client.getGenerativeModel({ model: modelId });
    // Minimal test - just 2 tokens
    const result = await model.generateContent("Hi");
    const text = result.response.text();
    console.log(`✅ ${modelId}: OK (${text.substring(0, 20)}...)`);
  } catch (error: any) {
    const msg = error.message || String(error);
    if (msg.includes("404")) {
      console.log(`❌ ${modelId}: Model not found (404)`);
    } else if (msg.includes("403")) {
      console.log(`❌ ${modelId}: Access denied (403)`);
    } else {
      console.log(`❌ ${modelId}: ${msg.substring(0, 60)}`);
    }
  }
}

async function main() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    console.error("❌ GOOGLE_AI_API_KEY not found in .env.local");
    process.exit(1);
  }

  console.log("\n=== VERIFICACIÓN DE MODELOS GEMINI ===\n");
  console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}\n`);

  const client = new GoogleGenerativeAI(apiKey);

  for (const modelId of MODELS_TO_TEST) {
    await testModel(client, modelId);
  }

  console.log("\n=== FIN ===\n");
}

main().catch(console.error);

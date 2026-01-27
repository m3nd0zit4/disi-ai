/**
 * Provider Diagnosis Script
 * Tests ALL non-OpenAI providers with minimal token usage
 *
 * Purpose: Identify exact issues in request format, auth, and response parsing
 */

import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// =============================================================================
// TYPES
// =============================================================================

interface TestResult {
  provider: string;
  model: string;
  status: "OK" | "ERROR";
  latencyMs: number;
  response?: string;
  error?: {
    type: "auth" | "bad_request" | "not_found" | "timeout" | "parsing" | "unknown";
    message: string;
    httpStatus?: number;
    rawError?: string;
  };
  debug?: {
    requestSent: object;
    responseReceived: object;
  };
}

// =============================================================================
// MINIMAL TEST PROMPT
// =============================================================================

const MINIMAL_PROMPT = "Reply with only: OK";
const MAX_TOKENS = 10;

// =============================================================================
// TEST FUNCTIONS BY PROVIDER
// =============================================================================

/**
 * Test Anthropic/Claude
 */
async function testAnthropic(apiKey: string, modelId: string): Promise<TestResult> {
  const start = Date.now();
  const provider = "Anthropic";

  const requestBody = {
    model: modelId,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: MINIMAL_PROMPT }],
  };

  console.log(`\n[${provider}] Testing ${modelId}...`);
  console.log(`[${provider}] Request:`, JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    const latencyMs = Date.now() - start;
    const data = await response.json();

    console.log(`[${provider}] Response status: ${response.status}`);
    console.log(`[${provider}] Response body:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      return {
        provider,
        model: modelId,
        status: "ERROR",
        latencyMs,
        error: {
          type: response.status === 401 ? "auth" : response.status === 404 ? "not_found" : "bad_request",
          message: data.error?.message || `HTTP ${response.status}`,
          httpStatus: response.status,
          rawError: JSON.stringify(data),
        },
        debug: { requestSent: requestBody, responseReceived: data },
      };
    }

    // Extract content from Anthropic response format
    const content = data.content?.[0]?.text || "";

    return {
      provider,
      model: modelId,
      status: "OK",
      latencyMs,
      response: content,
      debug: { requestSent: requestBody, responseReceived: data },
    };
  } catch (error: any) {
    return {
      provider,
      model: modelId,
      status: "ERROR",
      latencyMs: Date.now() - start,
      error: {
        type: error.name === "AbortError" ? "timeout" : "unknown",
        message: error.message,
        rawError: String(error),
      },
    };
  }
}

/**
 * Test Google/Gemini
 */
async function testGoogle(apiKey: string, modelId: string): Promise<TestResult> {
  const start = Date.now();
  const provider = "Google";

  const requestBody = {
    contents: [{ parts: [{ text: MINIMAL_PROMPT }] }],
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.1,
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  console.log(`\n[${provider}] Testing ${modelId}...`);
  console.log(`[${provider}] Endpoint: ${endpoint.replace(apiKey, "***")}`);
  console.log(`[${provider}] Request:`, JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const latencyMs = Date.now() - start;
    const data = await response.json();

    console.log(`[${provider}] Response status: ${response.status}`);
    console.log(`[${provider}] Response body:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      return {
        provider,
        model: modelId,
        status: "ERROR",
        latencyMs,
        error: {
          type: response.status === 403 ? "auth" : response.status === 404 ? "not_found" : "bad_request",
          message: data.error?.message || `HTTP ${response.status}`,
          httpStatus: response.status,
          rawError: JSON.stringify(data),
        },
        debug: { requestSent: requestBody, responseReceived: data },
      };
    }

    // Extract content from Gemini response format
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
      provider,
      model: modelId,
      status: "OK",
      latencyMs,
      response: content,
      debug: { requestSent: requestBody, responseReceived: data },
    };
  } catch (error: any) {
    return {
      provider,
      model: modelId,
      status: "ERROR",
      latencyMs: Date.now() - start,
      error: {
        type: error.name === "AbortError" ? "timeout" : "unknown",
        message: error.message,
        rawError: String(error),
      },
    };
  }
}

/**
 * Test xAI/Grok (OpenAI-compatible endpoint)
 */
async function testXAI(apiKey: string, modelId: string): Promise<TestResult> {
  const start = Date.now();
  const provider = "xAI";

  const requestBody = {
    model: modelId,
    messages: [{ role: "user", content: MINIMAL_PROMPT }],
    max_tokens: MAX_TOKENS,
    temperature: 0.1,
  };

  console.log(`\n[${provider}] Testing ${modelId}...`);
  console.log(`[${provider}] Request:`, JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const latencyMs = Date.now() - start;
    const data = await response.json();

    console.log(`[${provider}] Response status: ${response.status}`);
    console.log(`[${provider}] Response body:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      return {
        provider,
        model: modelId,
        status: "ERROR",
        latencyMs,
        error: {
          type: response.status === 401 ? "auth" : response.status === 404 ? "not_found" : "bad_request",
          message: data.error?.message || `HTTP ${response.status}`,
          httpStatus: response.status,
          rawError: JSON.stringify(data),
        },
        debug: { requestSent: requestBody, responseReceived: data },
      };
    }

    // Extract content from OpenAI-compatible response format
    const content = data.choices?.[0]?.message?.content || "";

    return {
      provider,
      model: modelId,
      status: "OK",
      latencyMs,
      response: content,
      debug: { requestSent: requestBody, responseReceived: data },
    };
  } catch (error: any) {
    return {
      provider,
      model: modelId,
      status: "ERROR",
      latencyMs: Date.now() - start,
      error: {
        type: error.name === "AbortError" ? "timeout" : "unknown",
        message: error.message,
        rawError: String(error),
      },
    };
  }
}

/**
 * Test DeepSeek (OpenAI-compatible endpoint)
 */
async function testDeepSeek(apiKey: string, modelId: string): Promise<TestResult> {
  const start = Date.now();
  const provider = "DeepSeek";

  const requestBody = {
    model: modelId,
    messages: [{ role: "user", content: MINIMAL_PROMPT }],
    max_tokens: MAX_TOKENS,
    temperature: 0.1,
  };

  console.log(`\n[${provider}] Testing ${modelId}...`);
  console.log(`[${provider}] Request:`, JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const latencyMs = Date.now() - start;
    const data = await response.json();

    console.log(`[${provider}] Response status: ${response.status}`);
    console.log(`[${provider}] Response body:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      return {
        provider,
        model: modelId,
        status: "ERROR",
        latencyMs,
        error: {
          type: response.status === 401 ? "auth" : response.status === 404 ? "not_found" : "bad_request",
          message: data.error?.message || `HTTP ${response.status}`,
          httpStatus: response.status,
          rawError: JSON.stringify(data),
        },
        debug: { requestSent: requestBody, responseReceived: data },
      };
    }

    // Extract content from OpenAI-compatible response format
    const content = data.choices?.[0]?.message?.content || "";

    return {
      provider,
      model: modelId,
      status: "OK",
      latencyMs,
      response: content,
      debug: { requestSent: requestBody, responseReceived: data },
    };
  } catch (error: any) {
    return {
      provider,
      model: modelId,
      status: "ERROR",
      latencyMs: Date.now() - start,
      error: {
        type: error.name === "AbortError" ? "timeout" : "unknown",
        message: error.message,
        rawError: String(error),
      },
    };
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("PROVIDER DIAGNOSIS - Non-OpenAI Models");
  console.log("=".repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Prompt: "${MINIMAL_PROMPT}"`);
  console.log(`Max tokens: ${MAX_TOKENS}`);
  console.log("=".repeat(60));

  // Check API keys
  const keys = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_AI_API_KEY,
    xai: process.env.XAI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
  };

  console.log("\n📋 API Key Status:");
  console.log(`  Anthropic: ${keys.anthropic ? "✅ Found" : "❌ Missing"}`);
  console.log(`  Google:    ${keys.google ? "✅ Found" : "❌ Missing"}`);
  console.log(`  xAI:       ${keys.xai ? "✅ Found" : "❌ Missing"}`);
  console.log(`  DeepSeek:  ${keys.deepseek ? "✅ Found" : "❌ Missing"}`);

  const results: TestResult[] = [];

  // Test Anthropic
  if (keys.anthropic) {
    console.log("\n" + "=".repeat(60));
    console.log("TESTING ANTHROPIC (Claude)");
    console.log("=".repeat(60));

    const claudeModels = [
      "claude-sonnet-4-5-20250929",
      "claude-haiku-4-5-20251001",
      "claude-3-haiku-20240307",
    ];

    for (const model of claudeModels) {
      const result = await testAnthropic(keys.anthropic, model);
      results.push(result);
    }
  }

  // Test Google
  if (keys.google) {
    console.log("\n" + "=".repeat(60));
    console.log("TESTING GOOGLE (Gemini)");
    console.log("=".repeat(60));

    const geminiModels = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-3-flash-preview",
    ];

    for (const model of geminiModels) {
      const result = await testGoogle(keys.google, model);
      results.push(result);
    }
  }

  // Test xAI
  if (keys.xai) {
    console.log("\n" + "=".repeat(60));
    console.log("TESTING xAI (Grok)");
    console.log("=".repeat(60));

    const grokModels = [
      "grok-3",
      "grok-3-mini",
    ];

    for (const model of grokModels) {
      const result = await testXAI(keys.xai, model);
      results.push(result);
    }
  }

  // Test DeepSeek
  if (keys.deepseek) {
    console.log("\n" + "=".repeat(60));
    console.log("TESTING DEEPSEEK");
    console.log("=".repeat(60));

    const deepseekModels = [
      "deepseek-chat",
    ];

    for (const model of deepseekModels) {
      const result = await testDeepSeek(keys.deepseek, model);
      results.push(result);
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  console.log("\n| Provider  | Model                         | Status | Latency | Response/Error");
  console.log("|-----------|-------------------------------|--------|---------|---------------");

  for (const r of results) {
    const statusIcon = r.status === "OK" ? "✅" : "❌";
    const latency = `${r.latencyMs}ms`.padEnd(7);
    const detail = r.status === "OK"
      ? r.response?.substring(0, 30) || ""
      : `${r.error?.type}: ${r.error?.message?.substring(0, 40)}`;

    console.log(`| ${r.provider.padEnd(9)} | ${r.model.padEnd(29)} | ${statusIcon}     | ${latency} | ${detail}`);
  }

  const ok = results.filter(r => r.status === "OK").length;
  const errors = results.filter(r => r.status === "ERROR").length;

  console.log("\n" + "=".repeat(60));
  console.log(`TOTAL: ${results.length} models tested`);
  console.log(`✅ Working: ${ok}`);
  console.log(`❌ Errors:  ${errors}`);
  console.log("=".repeat(60));

  // Print detailed errors
  if (errors > 0) {
    console.log("\n🔴 DETAILED ERRORS:");
    for (const r of results.filter(r => r.status === "ERROR")) {
      console.log(`\n--- ${r.provider} / ${r.model} ---`);
      console.log(`Type: ${r.error?.type}`);
      console.log(`HTTP Status: ${r.error?.httpStatus || "N/A"}`);
      console.log(`Message: ${r.error?.message}`);
      if (r.error?.rawError) {
        console.log(`Raw: ${r.error.rawError.substring(0, 200)}`);
      }
    }
  }
}

main().catch(console.error);

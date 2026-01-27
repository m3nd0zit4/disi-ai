/**
 * AI Providers Integration Tests
 *
 * Tests all AI provider services to verify they are operational:
 * - OpenAI (GPT)
 * - Anthropic (Claude)
 * - Google (Gemini)
 * - xAI (Grok)
 * - DeepSeek
 *
 * Run with: npx tsx tests/ai-providers.test.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

import { OpenAIService } from "../lib/aiServices/openai";
import { AnthropicService } from "../lib/aiServices/anthropic";
import { GoogleService } from "../lib/aiServices/google";
import { XAIService } from "../lib/aiServices/xai";
import { DeepSeekService } from "../lib/aiServices/deepseek";
import { getAIService } from "../lib/aiServices";

// Test configuration
const TEST_PROMPT = "Say 'Hello' and nothing else.";
const TEST_MESSAGES = [{ role: "user", content: TEST_PROMPT }];

interface TestResult {
  provider: string;
  model: string;
  status: "success" | "error";
  response?: string;
  error?: string;
  latency?: number;
}

const results: TestResult[] = [];

// Color helpers for console output
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

async function testOpenAI(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    results.push({ provider: "OpenAI", model: "N/A", status: "error", error: "API key not found" });
    return;
  }

  const service = new OpenAIService(apiKey);
  const models = ["gpt-4o-mini", "gpt-4o"];

  for (const model of models) {
    const start = Date.now();
    try {
      const response = await service.generateResponse({
        model,
        messages: TEST_MESSAGES,
        maxTokens: 50,
      });

      results.push({
        provider: "OpenAI",
        model,
        status: "success",
        response: response.content.substring(0, 100),
        latency: Date.now() - start,
      });
    } catch (error) {
      results.push({
        provider: "OpenAI",
        model,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - start,
      });
    }
  }
}

async function testAnthropic(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    results.push({ provider: "Anthropic", model: "N/A", status: "error", error: "API key not found" });
    return;
  }

  const service = new AnthropicService(apiKey);
  // Claude 4.5 models (January 2026)
  const models = [
    "claude-sonnet-4-5-20250929",
    "claude-haiku-4-5-20251001",
    "claude-3-haiku-20240307", // Legacy fallback
  ];

  for (const model of models) {
    const start = Date.now();
    try {
      const response = await service.generateResponse({
        model,
        messages: TEST_MESSAGES,
        maxTokens: 50,
      });

      results.push({
        provider: "Anthropic",
        model,
        status: "success",
        response: response.content.substring(0, 100),
        latency: Date.now() - start,
      });
    } catch (error) {
      results.push({
        provider: "Anthropic",
        model,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - start,
      });
    }
  }
}

async function testGoogle(): Promise<void> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    results.push({ provider: "Google", model: "N/A", status: "error", error: "API key not found" });
    return;
  }

  const service = new GoogleService(apiKey);
  // Note: Available models depend on API key permissions
  // gemini-2.0-flash-exp works, older models may require different API access
  const models = ["gemini-2.0-flash-exp"];

  for (const model of models) {
    const start = Date.now();
    try {
      const response = await service.generateResponse({
        model,
        messages: TEST_MESSAGES,
        maxTokens: 50,
      });

      results.push({
        provider: "Google",
        model,
        status: "success",
        response: response.content.substring(0, 100),
        latency: Date.now() - start,
      });
    } catch (error) {
      results.push({
        provider: "Google",
        model,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - start,
      });
    }
  }
}

async function testXAI(): Promise<void> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    results.push({ provider: "xAI", model: "N/A", status: "error", error: "API key not found" });
    return;
  }

  const service = new XAIService(apiKey);
  // Grok models (January 2026) - grok-4 is latest, grok-3 still available
  const models = ["grok-4", "grok-3", "grok-3-mini"];

  for (const model of models) {
    const start = Date.now();
    try {
      const response = await service.generateResponse({
        model,
        messages: TEST_MESSAGES,
        maxTokens: 50,
      });

      results.push({
        provider: "xAI",
        model,
        status: "success",
        response: response.content.substring(0, 100),
        latency: Date.now() - start,
      });
    } catch (error) {
      results.push({
        provider: "xAI",
        model,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - start,
      });
    }
  }
}

async function testDeepSeek(): Promise<void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    results.push({ provider: "DeepSeek", model: "N/A", status: "error", error: "API key not found" });
    return;
  }

  const service = new DeepSeekService(apiKey);
  const models = ["deepseek-chat"];

  for (const model of models) {
    const start = Date.now();
    try {
      const response = await service.generateResponse({
        model,
        messages: TEST_MESSAGES,
        maxTokens: 50,
      });

      results.push({
        provider: "DeepSeek",
        model,
        status: "success",
        response: response.content.substring(0, 100),
        latency: Date.now() - start,
      });
    } catch (error) {
      results.push({
        provider: "DeepSeek",
        model,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - start,
      });
    }
  }
}

async function testGetAIServiceFactory(): Promise<void> {
  console.log(colors.cyan("\n--- Testing getAIService Factory ---\n"));

  const providers = [
    { name: "gpt", key: process.env.OPENAI_API_KEY },
    { name: "claude", key: process.env.ANTHROPIC_API_KEY },
    { name: "gemini", key: process.env.GOOGLE_AI_API_KEY },
    { name: "grok", key: process.env.XAI_API_KEY },
    { name: "deepseek", key: process.env.DEEPSEEK_API_KEY },
  ];

  for (const { name, key } of providers) {
    try {
      if (!key) {
        console.log(`  ${colors.yellow("⚠")} ${name}: No API key configured`);
        continue;
      }

      const service = getAIService(name, key);
      const isValid = await service.validateApiKey();

      if (isValid) {
        console.log(`  ${colors.green("✓")} ${name}: API key valid`);
      } else {
        console.log(`  ${colors.red("✗")} ${name}: API key invalid`);
      }
    } catch (error) {
      console.log(`  ${colors.red("✗")} ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function printResults(): void {
  console.log(colors.bold("\n" + "=".repeat(70)));
  console.log(colors.bold("                    AI PROVIDERS TEST RESULTS"));
  console.log("=".repeat(70) + "\n");

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.provider]) acc[r.provider] = [];
    acc[r.provider].push(r);
    return acc;
  }, {} as Record<string, TestResult[]>);

  for (const [provider, providerResults] of Object.entries(grouped)) {
    console.log(colors.bold(`${provider}:`));

    for (const result of providerResults) {
      const statusIcon = result.status === "success" ? colors.green("✓") : colors.red("✗");
      const latencyStr = result.latency ? `(${result.latency}ms)` : "";

      if (result.status === "success") {
        console.log(`  ${statusIcon} ${result.model} ${colors.cyan(latencyStr)}`);
        console.log(`    Response: "${result.response?.trim()}"`);
      } else {
        console.log(`  ${statusIcon} ${result.model} ${colors.cyan(latencyStr)}`);
        console.log(`    ${colors.red(`Error: ${result.error}`)}`);
      }
    }
    console.log();
  }

  // Summary
  const total = results.length;
  const successful = results.filter(r => r.status === "success").length;
  const failed = total - successful;

  console.log("=".repeat(70));
  console.log(colors.bold("SUMMARY:"));
  console.log(`  Total tests: ${total}`);
  console.log(`  ${colors.green(`Passed: ${successful}`)}`);
  console.log(`  ${colors.red(`Failed: ${failed}`)}`);
  console.log("=".repeat(70) + "\n");
}

async function main(): Promise<void> {
  console.log(colors.bold("\n🚀 Starting AI Providers Integration Tests...\n"));

  // Test factory function first
  await testGetAIServiceFactory();

  console.log(colors.cyan("\n--- Testing Individual Providers ---\n"));

  // Test all providers
  console.log("Testing OpenAI...");
  await testOpenAI();

  console.log("Testing Anthropic...");
  await testAnthropic();

  console.log("Testing Google...");
  await testGoogle();

  console.log("Testing xAI...");
  await testXAI();

  console.log("Testing DeepSeek...");
  await testDeepSeek();

  // Print results
  printResults();

  // Exit with error code if any tests failed
  const failed = results.filter(r => r.status === "error").length;
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);

/**
 * AI Connection Diagnostic Test
 * Tests all AI model integrations for connectivity and response
 */

import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface TestResult {
  provider: string;
  model: string;
  modelId: string;
  type: "text" | "image" | "video" | "embedding";
  status: "OK" | "ERROR" | "SKIPPED" | "NO_KEY";
  latency?: number;
  notes: string;
}

const results: TestResult[] = [];

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

function isReasoningModel(model: string): boolean {
  return model.startsWith('o1') || model.startsWith('o3') || model.includes('gpt-5');
}

async function testOpenAIText(
  client: OpenAI,
  modelId: string,
  modelName: string
): Promise<TestResult> {
  const start = Date.now();
  const isReasoning = isReasoningModel(modelId);

  try {
    const params: any = {
      model: modelId,
      messages: [{ role: "user", content: "Reply only with: OK" }],
      stream: false,
    };

    // Use max_completion_tokens for reasoning models
    if (isReasoning) {
      params.max_completion_tokens = 50;
    } else {
      params.max_tokens = 10;
      params.temperature = 0.7;
    }

    const completion = await client.chat.completions.create(params);
    const latency = Date.now() - start;
    const content = completion.choices[0]?.message?.content || "";
    return {
      provider: "OpenAI",
      model: modelName,
      modelId,
      type: "text",
      status: "OK",
      latency,
      notes: content.substring(0, 50),
    };
  } catch (error: any) {
    return {
      provider: "OpenAI",
      model: modelName,
      modelId,
      type: "text",
      status: "ERROR",
      latency: Date.now() - start,
      notes: error.message?.substring(0, 100) || "Unknown error",
    };
  }
}

async function testOpenAIImage(
  client: OpenAI,
  modelId: string,
  modelName: string
): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await client.images.generate({
      model: modelId,
      prompt: "A simple blue square on white background",
      size: "1024x1024",
      n: 1,
    });
    const latency = Date.now() - start;
    const hasUrl = !!response.data[0]?.url || !!response.data[0]?.b64_json;
    return {
      provider: "OpenAI",
      model: modelName,
      modelId,
      type: "image",
      status: hasUrl ? "OK" : "ERROR",
      latency,
      notes: hasUrl ? "Image generated successfully" : "No image URL returned",
    };
  } catch (error: any) {
    return {
      provider: "OpenAI",
      model: modelName,
      modelId,
      type: "image",
      status: "ERROR",
      latency: Date.now() - start,
      notes: error.message?.substring(0, 100) || "Unknown error",
    };
  }
}

async function testAnthropicText(
  client: Anthropic,
  modelId: string,
  modelName: string
): Promise<TestResult> {
  const start = Date.now();
  try {
    const message = await client.messages.create({
      model: modelId,
      max_tokens: 10,
      messages: [{ role: "user", content: "Reply only with: OK" }],
    });
    const latency = Date.now() - start;
    const content =
      message.content[0]?.type === "text" ? message.content[0].text : "";
    return {
      provider: "Anthropic",
      model: modelName,
      modelId,
      type: "text",
      status: "OK",
      latency,
      notes: content.substring(0, 50),
    };
  } catch (error: any) {
    return {
      provider: "Anthropic",
      model: modelName,
      modelId,
      type: "text",
      status: "ERROR",
      latency: Date.now() - start,
      notes: error.message?.substring(0, 100) || "Unknown error",
    };
  }
}

async function testGeminiText(
  client: GoogleGenerativeAI,
  modelId: string,
  modelName: string
): Promise<TestResult> {
  const start = Date.now();
  try {
    const model = client.getGenerativeModel({ model: modelId });
    const result = await model.generateContent("Reply only with: OK");
    const latency = Date.now() - start;
    const content = result.response.text();
    return {
      provider: "Google",
      model: modelName,
      modelId,
      type: "text",
      status: "OK",
      latency,
      notes: content.substring(0, 50),
    };
  } catch (error: any) {
    return {
      provider: "Google",
      model: modelName,
      modelId,
      type: "text",
      status: "ERROR",
      latency: Date.now() - start,
      notes: error.message?.substring(0, 100) || "Unknown error",
    };
  }
}

async function testGeminiImage(
  client: GoogleGenerativeAI,
  modelId: string,
  modelName: string
): Promise<TestResult> {
  const start = Date.now();
  try {
    const model = client.getGenerativeModel({
      model: modelId,
      generationConfig: {
        // @ts-ignore - responseModalities is supported for image models
        responseModalities: ["image", "text"],
      },
    });

    const result = await model.generateContent(
      "Generate a simple blue square on white background"
    );
    const latency = Date.now() - start;

    // Check for image data in response
    const parts = result.response.candidates?.[0]?.content?.parts || [];
    let hasImage = false;

    for (const part of parts) {
      // @ts-ignore - inlineData contains image data
      if (part.inlineData) {
        hasImage = true;
        break;
      }
    }

    return {
      provider: "Google",
      model: modelName,
      modelId,
      type: "image",
      status: hasImage ? "OK" : "ERROR",
      latency,
      notes: hasImage ? "Image generated successfully" : "No image in response",
    };
  } catch (error: any) {
    return {
      provider: "Google",
      model: modelName,
      modelId,
      type: "image",
      status: "ERROR",
      latency: Date.now() - start,
      notes: error.message?.substring(0, 100) || "Unknown error",
    };
  }
}

async function testVeoConnectivity(
  apiKey: string,
  modelId: string,
  modelName: string
): Promise<TestResult> {
  const start = Date.now();
  try {
    // Test connectivity by starting a video generation (we'll check if endpoint responds)
    const baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    const endpoint = `${baseUrl}/models/${modelId}:predictLongRunning?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt: "A blue circle moving slowly" }],
        parameters: {
          aspectRatio: "16:9",
          durationSeconds: 4,
          sampleCount: 1,
        },
      }),
    });

    const latency = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      // If we get an operation name, the API is working
      if (data.name) {
        return {
          provider: "Google",
          model: modelName,
          modelId,
          type: "video",
          status: "OK",
          latency,
          notes: `Operation started: ${data.name.substring(0, 30)}...`,
        };
      }
    }

    // Check for specific error messages
    const errorData = await response.text();

    // 403 means API is available but not enabled/authorized
    if (response.status === 403) {
      return {
        provider: "Google",
        model: modelName,
        modelId,
        type: "video",
        status: "ERROR",
        latency,
        notes: "API not enabled or quota exceeded",
      };
    }

    return {
      provider: "Google",
      model: modelName,
      modelId,
      type: "video",
      status: "ERROR",
      latency,
      notes: `HTTP ${response.status}: ${errorData.substring(0, 50)}`,
    };
  } catch (error: any) {
    return {
      provider: "Google",
      model: modelName,
      modelId,
      type: "video",
      status: "ERROR",
      latency: Date.now() - start,
      notes: error.message?.substring(0, 100) || "Unknown error",
    };
  }
}

async function testGrokText(
  client: OpenAI,
  modelId: string,
  modelName: string
): Promise<TestResult> {
  const start = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: "Reply only with: OK" }],
      max_tokens: 10,
    });
    const latency = Date.now() - start;
    const content = completion.choices[0]?.message?.content || "";
    return {
      provider: "xAI",
      model: modelName,
      modelId,
      type: "text",
      status: "OK",
      latency,
      notes: content.substring(0, 50),
    };
  } catch (error: any) {
    return {
      provider: "xAI",
      model: modelName,
      modelId,
      type: "text",
      status: "ERROR",
      latency: Date.now() - start,
      notes: error.message?.substring(0, 100) || "Unknown error",
    };
  }
}

async function testDeepSeekText(
  client: OpenAI,
  modelId: string,
  modelName: string
): Promise<TestResult> {
  const start = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: "Reply only with: OK" }],
      max_tokens: 10,
    });
    const latency = Date.now() - start;
    const content = completion.choices[0]?.message?.content || "";
    return {
      provider: "DeepSeek",
      model: modelName,
      modelId,
      type: "text",
      status: "OK",
      latency,
      notes: content.substring(0, 50),
    };
  } catch (error: any) {
    return {
      provider: "DeepSeek",
      model: modelName,
      modelId,
      type: "text",
      status: "ERROR",
      latency: Date.now() - start,
      notes: error.message?.substring(0, 100) || "Unknown error",
    };
  }
}

async function testOpenAIEmbedding(client: OpenAI): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: "test",
    });
    const latency = Date.now() - start;
    const hasEmbedding = response.data[0]?.embedding?.length > 0;
    return {
      provider: "OpenAI",
      model: "text-embedding-3-small",
      modelId: "text-embedding-3-small",
      type: "embedding",
      status: hasEmbedding ? "OK" : "ERROR",
      latency,
      notes: hasEmbedding
        ? `Embedding size: ${response.data[0].embedding.length}`
        : "No embedding returned",
    };
  } catch (error: any) {
    return {
      provider: "OpenAI",
      model: "text-embedding-3-small",
      modelId: "text-embedding-3-small",
      type: "embedding",
      status: "ERROR",
      latency: Date.now() - start,
      notes: error.message?.substring(0, 100) || "Unknown error",
    };
  }
}

async function testSoraConnectivity(
  client: OpenAI,
  modelId: string,
  modelName: string
): Promise<TestResult> {
  const start = Date.now();
  try {
    // Start a video generation job to test connectivity
    // @ts-ignore - videos API may not be fully typed
    const video = await client.videos.create({
      model: modelId as any,
      prompt: "A simple blue circle slowly moving across the screen",
      size: "1280x720" as any,
      seconds: "4" as any,
    });

    const latency = Date.now() - start;

    if (video.id) {
      return {
        provider: "OpenAI",
        model: modelName,
        modelId,
        type: "video",
        status: "OK",
        latency,
        notes: `Job started: ${video.id.substring(0, 25)}...`,
      };
    }

    return {
      provider: "OpenAI",
      model: modelName,
      modelId,
      type: "video",
      status: "ERROR",
      latency,
      notes: "No job ID returned",
    };
  } catch (error: any) {
    return {
      provider: "OpenAI",
      model: modelName,
      modelId,
      type: "video",
      status: "ERROR",
      latency: Date.now() - start,
      notes: error.message?.substring(0, 100) || "Unknown error",
    };
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log("\n========================================");
  console.log("🔬 AI CONNECTION DIAGNOSTIC TEST");
  console.log("========================================\n");
  console.log(`📅 Date: ${new Date().toISOString()}\n`);

  // Check API Keys
  const keys = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_AI_API_KEY,
    xai: process.env.XAI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
  };

  console.log("🔑 API Key Status:");
  console.log(`   OpenAI:    ${keys.openai ? "✅ Found" : "❌ Missing"}`);
  console.log(`   Anthropic: ${keys.anthropic ? "✅ Found" : "❌ Missing"}`);
  console.log(`   Google:    ${keys.google ? "✅ Found" : "❌ Missing"}`);
  console.log(`   xAI:       ${keys.xai ? "✅ Found" : "❌ Missing"}`);
  console.log(`   DeepSeek:  ${keys.deepseek ? "✅ Found" : "❌ Missing"}`);
  console.log("\n");

  // ============================================================================
  // OPENAI TESTS
  // ============================================================================
  if (keys.openai) {
    console.log("🧪 Testing OpenAI models...\n");
    const openai = new OpenAI({ apiKey: keys.openai });

    // Text models
    const openaiTextModels = [
      { id: "gpt-5.2", name: "GPT-5.2" },
      { id: "gpt-5.2-pro", name: "GPT-5.2 Pro" },
      { id: "gpt-5", name: "GPT-5" },
      { id: "gpt-5-mini", name: "GPT-5 mini" },
      { id: "gpt-5-nano", name: "GPT-5 nano" },
      { id: "gpt-4.1", name: "GPT-4.1" },
    ];

    for (const model of openaiTextModels) {
      console.log(`   Testing ${model.name}...`);
      const result = await testOpenAIText(openai, model.id, model.name);
      results.push(result);
      console.log(
        `   ${result.status === "OK" ? "✅" : "❌"} ${model.name}: ${result.notes}`
      );
    }

    // Image models
    const openaiImageModels = [
      { id: "gpt-image-1.5", name: "GPT Image 1.5" },
      { id: "gpt-image-1", name: "GPT Image 1" },
      { id: "gpt-image-1-mini", name: "GPT Image 1 Mini" },
      { id: "dall-e-3", name: "DALL-E 3" },
    ];

    console.log("\n   Testing image models...");
    for (const model of openaiImageModels) {
      console.log(`   Testing ${model.name}...`);
      const result = await testOpenAIImage(openai, model.id, model.name);
      results.push(result);
      console.log(
        `   ${result.status === "OK" ? "✅" : "❌"} ${model.name}: ${result.notes}`
      );
    }

    // Video models (Sora)
    const openaiVideoModels = [
      { id: "sora-2", name: "Sora 2" },
      { id: "sora-2-pro", name: "Sora 2 Pro" },
    ];

    console.log("\n   Testing Sora video models...");
    for (const model of openaiVideoModels) {
      console.log(`   Testing ${model.name}...`);
      const result = await testSoraConnectivity(openai, model.id, model.name);
      results.push(result);
      console.log(
        `   ${result.status === "OK" ? "✅" : "❌"} ${model.name}: ${result.notes}`
      );
    }

    // Embeddings
    console.log("\n   Testing embeddings...");
    const embeddingResult = await testOpenAIEmbedding(openai);
    results.push(embeddingResult);
    console.log(
      `   ${embeddingResult.status === "OK" ? "✅" : "❌"} Embeddings: ${embeddingResult.notes}`
    );
  } else {
    // Add NO_KEY results for all OpenAI models
    const allOpenAIModels = [
      "gpt-5.2",
      "gpt-5.2-pro",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-4-1",
      "gpt-image-1.5",
      "gpt-image-1",
      "gpt-image-1-mini",
      "dall-e-3",
      "sora-2",
      "sora-2-pro",
    ];
    for (const modelId of allOpenAIModels) {
      results.push({
        provider: "OpenAI",
        model: modelId,
        modelId,
        type: "text",
        status: "NO_KEY",
        notes: "OPENAI_API_KEY not configured",
      });
    }
  }

  // ============================================================================
  // ANTHROPIC TESTS
  // ============================================================================
  if (keys.anthropic) {
    console.log("\n🧪 Testing Anthropic models...\n");
    const anthropic = new Anthropic({ apiKey: keys.anthropic });

    const claudeModels = [
      { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
      { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5" },
      { id: "claude-opus-4-1-20250805", name: "Claude Opus 4.1" },
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
    ];

    for (const model of claudeModels) {
      console.log(`   Testing ${model.name}...`);
      const result = await testAnthropicText(anthropic, model.id, model.name);
      results.push(result);
      console.log(
        `   ${result.status === "OK" ? "✅" : "❌"} ${model.name}: ${result.notes}`
      );
    }
  } else {
    const claudeModels = [
      "claude-sonnet-4-5-20250929",
      "claude-haiku-4-5-20251001",
      "claude-opus-4-5-20251101",
      "claude-opus-4-1-20250805",
      "claude-sonnet-4-20250514",
      "claude-3-haiku-20240307",
    ];
    for (const modelId of claudeModels) {
      results.push({
        provider: "Anthropic",
        model: modelId,
        modelId,
        type: "text",
        status: "NO_KEY",
        notes: "ANTHROPIC_API_KEY not configured",
      });
    }
  }

  // ============================================================================
  // GOOGLE TESTS
  // ============================================================================
  if (keys.google) {
    console.log("\n🧪 Testing Google Gemini models...\n");
    const google = new GoogleGenerativeAI(keys.google);

    const geminiTextModels = [
      { id: "gemini-3-pro-preview", name: "Gemini 3 Pro" },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-flash-preview-09-2025", name: "Gemini 2.5 Flash Preview" },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
    ];

    for (const model of geminiTextModels) {
      console.log(`   Testing ${model.name}...`);
      const result = await testGeminiText(google, model.id, model.name);
      results.push(result);
      console.log(
        `   ${result.status === "OK" ? "✅" : "❌"} ${model.name}: ${result.notes}`
      );
    }

    // Image models (Nano Banana)
    const geminiImageModels = [
      { id: "gemini-3-pro-image-preview", name: "Nano Banana Pro" },
      { id: "gemini-2.5-flash-image", name: "Nano Banana" },
    ];

    console.log("\n   Testing Gemini image models (Nano Banana)...");
    for (const model of geminiImageModels) {
      console.log(`   Testing ${model.name}...`);
      const result = await testGeminiImage(google, model.id, model.name);
      results.push(result);
      console.log(
        `   ${result.status === "OK" ? "✅" : "❌"} ${model.name}: ${result.notes}`
      );
    }

    // Video models (Veo) - Test connectivity only (video generation is slow)
    const veoModels = [
      { id: "veo-3.1-generate-preview", name: "Veo 3.1" },
      { id: "veo-3.1-fast-generate-preview", name: "Veo 3.1 Fast" },
    ];

    console.log("\n   Testing Veo video models (connectivity check)...");
    for (const model of veoModels) {
      console.log(`   Testing ${model.name}...`);
      const result = await testVeoConnectivity(keys.google!, model.id, model.name);
      results.push(result);
      console.log(
        `   ${result.status === "OK" ? "✅" : "❌"} ${model.name}: ${result.notes}`
      );
    }
  } else {
    const allGeminiModels = [
      "gemini-3-pro-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-2.5-flash-preview-09-2025",
      "gemini-2.5-flash-lite",
      "gemini-3-pro-image-preview",
      "gemini-2.5-flash-image",
      "veo-3.1-generate-preview",
      "veo-3.1-fast-generate-preview",
    ];
    for (const modelId of allGeminiModels) {
      results.push({
        provider: "Google",
        model: modelId,
        modelId,
        type: "text",
        status: "NO_KEY",
        notes: "GOOGLE_AI_API_KEY not configured",
      });
    }
  }

  // ============================================================================
  // XAI (GROK) TESTS
  // ============================================================================
  if (keys.xai) {
    console.log("\n🧪 Testing xAI Grok models...\n");
    const xai = new OpenAI({
      apiKey: keys.xai,
      baseURL: "https://api.x.ai/v1",
    });

    const grokModels = [
      { id: "grok-4", name: "Grok 4" },
      { id: "grok-3", name: "Grok 3" },
      { id: "grok-3-mini", name: "Grok 3 Mini" },
    ];

    for (const model of grokModels) {
      console.log(`   Testing ${model.name}...`);
      const result = await testGrokText(xai, model.id, model.name);
      results.push(result);
      console.log(
        `   ${result.status === "OK" ? "✅" : "❌"} ${model.name}: ${result.notes}`
      );
    }
  } else {
    const grokModels = ["grok-4", "grok-3", "grok-3-mini"];
    for (const modelId of grokModels) {
      results.push({
        provider: "xAI",
        model: modelId,
        modelId,
        type: "text",
        status: "NO_KEY",
        notes: "XAI_API_KEY not configured",
      });
    }
  }

  // ============================================================================
  // DEEPSEEK TESTS
  // ============================================================================
  if (keys.deepseek) {
    console.log("\n🧪 Testing DeepSeek models...\n");
    const deepseek = new OpenAI({
      apiKey: keys.deepseek,
      baseURL: "https://api.deepseek.com/v1",
    });

    const deepseekModels = [
      { id: "deepseek-chat", name: "DeepSeek-V3.2" },
      { id: "deepseek-reasoner", name: "DeepSeek-V3.2 Reasoner" },
    ];

    for (const model of deepseekModels) {
      console.log(`   Testing ${model.name}...`);
      const result = await testDeepSeekText(deepseek, model.id, model.name);
      results.push(result);
      console.log(
        `   ${result.status === "OK" ? "✅" : "❌"} ${model.name}: ${result.notes}`
      );
    }
  } else {
    const deepseekModels = ["deepseek-chat", "deepseek-reasoner"];
    for (const modelId of deepseekModels) {
      results.push({
        provider: "DeepSeek",
        model: modelId,
        modelId,
        type: "text",
        status: "NO_KEY",
        notes: "DEEPSEEK_API_KEY not configured",
      });
    }
  }

  // ============================================================================
  // PRINT RESULTS
  // ============================================================================
  console.log("\n\n========================================");
  console.log("📊 RESULTS TABLE");
  console.log("========================================\n");

  // Print table header
  console.log(
    "| Provider   | Model                       | Type      | Status   | Latency  | Notes                                |"
  );
  console.log(
    "|------------|-----------------------------|-----------|----------|----------|--------------------------------------|"
  );

  // Print results
  for (const r of results) {
    const statusIcon =
      r.status === "OK"
        ? "✅ OK"
        : r.status === "SKIPPED"
          ? "⏭️ SKIP"
          : r.status === "NO_KEY"
            ? "🔑 NO KEY"
            : "❌ ERR";
    const latency = r.latency ? `${(r.latency / 1000).toFixed(2)}s` : "-";
    const notes = r.notes.substring(0, 35).padEnd(36);

    console.log(
      `| ${r.provider.padEnd(10)} | ${r.model.padEnd(27)} | ${r.type.padEnd(9)} | ${statusIcon.padEnd(8)} | ${latency.padEnd(8)} | ${notes} |`
    );
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  const ok = results.filter((r) => r.status === "OK").length;
  const errors = results.filter((r) => r.status === "ERROR").length;
  const skipped = results.filter((r) => r.status === "SKIPPED").length;
  const noKey = results.filter((r) => r.status === "NO_KEY").length;

  console.log("\n\n========================================");
  console.log("📈 SUMMARY");
  console.log("========================================");
  console.log(`   Total models tested: ${results.length}`);
  console.log(`   ✅ Functioning:      ${ok}`);
  console.log(`   ❌ With errors:      ${errors}`);
  console.log(`   ⏭️  Skipped:          ${skipped}`);
  console.log(`   🔑 No API key:       ${noKey}`);
  console.log("========================================\n");

  // Print errors if any
  if (errors > 0) {
    console.log("\n⚠️ ERRORS FOUND:");
    for (const r of results.filter((r) => r.status === "ERROR")) {
      console.log(`   - ${r.provider} ${r.model}: ${r.notes}`);
    }
  }

  console.log("\n✨ Diagnostic complete!\n");
}

// Run tests
runTests().catch(console.error);

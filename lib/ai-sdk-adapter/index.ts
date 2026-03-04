/**
 * Vercel AI SDK adapter: single abstraction for generateText and streamText
 * across OpenAI, Anthropic, Google, xAI, and DeepSeek.
 */

import { generateText, streamText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { OpenAIProvider } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import type {
  AISDKAdapterMessage,
  GenerateTextOptions,
  GenerateTextResult,
} from "./types";
import type { TextStreamPart } from "./normalize-ai-sdk-stream";
import { getBuiltInToolsForProvider } from "@/lib/agent/built-in-tools";

type BuiltInToolsRecord = Record<string, { description?: string; inputSchema: unknown; execute: (input: unknown) => Promise<unknown> }>;

const WEB_SEARCH_SLUGS = new Set(["web_search", "google_search", "x_search"]);

const PROVIDER_LEGACY: Record<string, string> = {
  claude: "anthropic",
  gpt: "openai",
  gemini: "google",
  grok: "xai",
  deepseek: "deepseek",
};

function normalizeProvider(provider: string): string {
  const key = provider.toLowerCase();
  return PROVIDER_LEGACY[key] ?? key;
}

export type ProviderInstance = ReturnType<typeof createOpenAI> | ReturnType<typeof createAnthropic> | ReturnType<typeof createGoogleGenerativeAI>;

/**
 * Returns the AI SDK provider instance for the given provider and API key.
 */
export function getAISDKProvider(provider: string, apiKey: string): ProviderInstance {
  const norm = normalizeProvider(provider);
  switch (norm) {
    case "openai":
      return createOpenAI({ apiKey });
    case "anthropic":
      return createAnthropic({ apiKey });
    case "google":
      return createGoogleGenerativeAI({ apiKey });
    case "xai":
      return createOpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
    case "deepseek":
      return createOpenAI({ apiKey, baseURL: "https://api.deepseek.com/v1" });
    default:
      return createOpenAI({ apiKey });
  }
}

/**
 * Returns the language model for the given provider, model ID, and API key.
 */
export function getAISDKModel(provider: string, modelId: string, apiKey: string): LanguageModelV2 {
  const p = getAISDKProvider(provider, apiKey) as { languageModel: (id: string) => LanguageModelV2 };
  return p.languageModel(modelId);
}

/**
 * Returns the model and any built-in tools to merge for the given provider, model, and builtInTools list.
 * When builtInTools is empty/undefined, returns the default model and no extra tools.
 */
async function getModelAndBuiltInToolsAsync(
  provider: string,
  modelId: string,
  apiKey: string,
  builtInTools: string[] | undefined
): Promise<{ model: LanguageModelV2; builtInToolsRecord: BuiltInToolsRecord }> {
  const norm = normalizeProvider(provider);
  const builtInToolsRecord: BuiltInToolsRecord = {};

  if (!builtInTools?.length) {
    if (norm === "openai") {
      const p = getAISDKProvider(provider, apiKey) as OpenAIProvider;
      return { model: p.chat(modelId), builtInToolsRecord };
    }
    if (norm === "xai") {
      return { model: getAISDKModel(provider, modelId, apiKey), builtInToolsRecord };
    }
    return { model: getAISDKModel(provider, modelId, apiKey), builtInToolsRecord };
  }

  if (norm === "openai") {
    const p = getAISDKProvider(provider, apiKey) as OpenAIProvider;
    const useResponses = builtInTools.includes("web_search");
    const model = useResponses ? p.responses(modelId) : p.chat(modelId);
    if (useResponses && builtInTools.includes("web_search")) {
      builtInToolsRecord.web_search = p.tools.webSearch() as unknown as BuiltInToolsRecord[string];
    }
    return { model, builtInToolsRecord };
  }

  if (norm === "google") {
    const p = getAISDKProvider(provider, apiKey) as ReturnType<typeof createGoogleGenerativeAI>;
    const model = p.languageModel(modelId);
    if (builtInTools.includes("google_search") && "tools" in p && typeof (p as { tools: { googleSearch: (opts?: unknown) => unknown } }).tools?.googleSearch === "function") {
      const tools = (p as { tools: { googleSearch: (opts?: unknown) => unknown } }).tools;
      builtInToolsRecord.google_search = tools.googleSearch({}) as unknown as BuiltInToolsRecord[string];
    }
    return { model, builtInToolsRecord };
  }

  if (norm === "xai") {
    try {
      const xaiModule = await import("@ai-sdk/xai");
      const createXai = xaiModule.createXai ?? xaiModule.default;
      const xai = typeof createXai === "function" ? createXai({ apiKey }) : createXai;
      if (xai?.responses && xai?.tools) {
        const model = xai.responses(modelId);
        if (builtInTools.includes("web_search") && xai.tools.webSearch) {
          builtInToolsRecord.web_search = xai.tools.webSearch() as unknown as BuiltInToolsRecord[string];
        }
        if (builtInTools.includes("x_search") && xai.tools.xSearch) {
          builtInToolsRecord.x_search = xai.tools.xSearch() as unknown as BuiltInToolsRecord[string];
        }
        if (builtInTools.includes("code_execution") && xai.tools.codeExecution) {
          builtInToolsRecord.code_execution = xai.tools.codeExecution() as unknown as BuiltInToolsRecord[string];
        }
        return { model, builtInToolsRecord };
      }
    } catch {
      // @ai-sdk/xai not installed or error: fallback to Chat API without built-in tools
    }
    return { model: getAISDKModel(provider, modelId, apiKey), builtInToolsRecord };
  }

  return { model: getAISDKModel(provider, modelId, apiKey), builtInToolsRecord };
}

/** Sync version for generateText when no xAI built-in tools (avoids async in generateText). */
function getModelAndBuiltInTools(
  provider: string,
  modelId: string,
  apiKey: string,
  builtInTools: string[] | undefined
): { model: LanguageModelV2; builtInToolsRecord: BuiltInToolsRecord } {
  const norm = normalizeProvider(provider);
  const builtInToolsRecord: BuiltInToolsRecord = {};
  if (norm === "xai" && builtInTools?.length) {
    // generateText with xAI built-in requires async path; use default model and no built-in tools for sync
    return { model: getAISDKModel(provider, modelId, apiKey), builtInToolsRecord };
  }
  if (!builtInTools?.length) {
    if (norm === "openai") {
      const p = getAISDKProvider(provider, apiKey) as OpenAIProvider;
      return { model: p.chat(modelId), builtInToolsRecord };
    }
    return { model: getAISDKModel(provider, modelId, apiKey), builtInToolsRecord };
  }
  if (norm === "openai") {
    const p = getAISDKProvider(provider, apiKey) as OpenAIProvider;
    const useResponses = builtInTools.includes("web_search");
    const model = useResponses ? p.responses(modelId) : p.chat(modelId);
    if (useResponses && builtInTools.includes("web_search")) {
      builtInToolsRecord.web_search = p.tools.webSearch() as unknown as BuiltInToolsRecord[string];
    }
    return { model, builtInToolsRecord };
  }
  if (norm === "google") {
    const p = getAISDKProvider(provider, apiKey) as ReturnType<typeof createGoogleGenerativeAI>;
    const model = p.languageModel(modelId);
    if (builtInTools.includes("google_search") && "tools" in p && typeof (p as { tools: { googleSearch: (opts?: unknown) => unknown } }).tools?.googleSearch === "function") {
      const tools = (p as { tools: { googleSearch: (opts?: unknown) => unknown } }).tools;
      builtInToolsRecord.google_search = tools.googleSearch({}) as unknown as BuiltInToolsRecord[string];
    }
    return { model, builtInToolsRecord };
  }
  return { model: getAISDKModel(provider, modelId, apiKey), builtInToolsRecord };
}

/**
 * Converts our message array to { system, messages } for the AI SDK.
 */
export function convertMessagesToAISDK(messages: AISDKAdapterMessage[]): { system?: string; messages: Array<{ role: "user" | "assistant"; content: string }> } {
  const system = messages.find((m) => m.role === "system")?.content;
  let rest = messages.filter((m) => m.role !== "system") as Array<{ role: "user" | "assistant"; content: string }>;
  if (rest.length === 0) {
    rest = [{ role: "user", content: "(No user message)" }];
  }
  return { system, messages: rest };
}

/**
 * Generate text (non-streaming) using the Vercel AI SDK.
 */
export async function generateTextWithAISDK(
  provider: string,
  modelId: string,
  apiKey: string,
  messages: AISDKAdapterMessage[],
  options: GenerateTextOptions = {}
): Promise<GenerateTextResult> {
  const { system, messages: msgs } = convertMessagesToAISDK(messages);

  const norm = normalizeProvider(provider);
  const builtInTools = options.builtInTools ?? (options.webSearch?.enabled && norm === "anthropic" ? ["web_search"] : undefined);
  const { model, builtInToolsRecord } = getModelAndBuiltInTools(provider, modelId, apiKey, builtInTools);

  const providerOptions: Record<string, unknown> = {};
  const useWebSearch = options.webSearch?.enabled ?? builtInTools?.includes("web_search");
  if (useWebSearch && norm === "anthropic") {
    providerOptions.anthropic = { experimental_toolChoice: "any" };
  }
  if (options.thinking?.enabled && norm === "anthropic") {
    providerOptions.anthropic = {
      ...(providerOptions.anthropic as object),
      thinking: { type: "enabled" as const, budgetTokens: options.thinking.budgetTokens ?? 5000 },
    };
  }

  const result = await generateText({
    model,
    system,
    messages: msgs,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 8000,
    abortSignal: options.signal,
    providerOptions: Object.keys(providerOptions).length ? providerOptions : undefined,
  });

  const usage = result.usage;
  const totalTokens = usage?.totalTokens ?? (usage && "promptTokens" in usage ? (usage as { promptTokens: number; completionTokens: number }).promptTokens + (usage as { promptTokens: number; completionTokens: number }).completionTokens : 0);

  let thinkingContent: string | undefined;
  if (result.experimental_providerMetadata && typeof result.experimental_providerMetadata === "object" && "anthropic" in result.experimental_providerMetadata) {
    const meta = (result.experimental_providerMetadata as { anthropic?: { thinking?: string } }).anthropic;
    thinkingContent = meta?.thinking;
  }

  const citations: GenerateTextResult["citations"] = [];
  if (result.sources?.length) {
    for (const s of result.sources) {
      if (s.type === "url" && "url" in s) {
        citations.push({ url: (s as { url: string }).url, title: (s as { title?: string }).title ?? "" });
      }
    }
  }

  return {
    content: result.text,
    tokens: typeof totalTokens === "number" ? totalTokens : { input: 0, output: 0, total: totalTokens },
    finishReason: result.finishReason,
    thinkingContent,
    citations: citations.length ? citations : undefined,
  };
}

/**
 * Stream text using the Vercel AI SDK. Returns fullStream; the caller should
 * use mapAISDKStreamToChunks(fullStream) and pass the result to StreamProcessor.processStream(stream).
 * When toolNames and maxSteps are provided, the SDK runs the tool loop (LLM → tool_calls → execute → re-inject → LLM).
 */
export async function streamTextWithAISDK(
  provider: string,
  modelId: string,
  apiKey: string,
  messages: AISDKAdapterMessage[],
  options: GenerateTextOptions & {
    maxTokens?: number;
    /** Tool names from the registry to enable for this call. When set, maxSteps is used. */
    toolNames?: string[];
    /** Max steps for the tool loop (default 5). Only used when toolNames is non-empty. */
    maxSteps?: number;
  } = {}
): Promise<{ fullStream: AsyncIterable<TextStreamPart> }> {
  const { system, messages: msgs } = convertMessagesToAISDK(messages);

  const norm = normalizeProvider(provider);
  let builtInTools = options.builtInTools;
  if ((!builtInTools || builtInTools.length === 0) && options.webSearch?.enabled) {
    builtInTools = getBuiltInToolsForProvider(provider, modelId).filter((s) =>
      WEB_SEARCH_SLUGS.has(s)
    );
    if (builtInTools.length === 0) builtInTools = undefined;
  }
  const { model, builtInToolsRecord } = await getModelAndBuiltInToolsAsync(provider, modelId, apiKey, builtInTools);

  const providerOptions: Record<string, unknown> = {};
  const useWebSearch = options.webSearch?.enabled ?? builtInTools?.includes("web_search");
  if (useWebSearch && norm === "anthropic") {
    providerOptions.anthropic = { experimental_toolChoice: "any" };
  }
  if (options.thinking?.enabled && norm === "anthropic") {
    providerOptions.anthropic = {
      ...(providerOptions.anthropic as object),
      thinking: { type: "enabled" as const, budgetTokens: options.thinking.budgetTokens ?? 5000 },
    };
  }

  let tools: Record<string, { description?: string; inputSchema: unknown; execute: (input: unknown) => Promise<unknown> }> | undefined;
  const customTools = options.toolNames?.length
    ? (await import("@/lib/agent/tools/registry")).getAISDKToolsForNames(options.toolNames)
    : {};
  tools = { ...builtInToolsRecord, ...customTools };
  if (Object.keys(tools).length === 0) tools = undefined;
  // AI SDK 5 uses stopWhen (e.g. stepCountIs(n)) for multi-step tool loops, not "maxSteps"
  const maxSteps = (options.toolNames?.length || Object.keys(builtInToolsRecord).length) ? (options.maxSteps ?? 5) : undefined;
  const stopWhen = maxSteps != null ? stepCountIs(maxSteps) : undefined;

  const result = streamText({
    model,
    system,
    messages: msgs,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 8000,
    abortSignal: options.signal,
    providerOptions: Object.keys(providerOptions).length ? providerOptions : undefined,
    ...(tools && Object.keys(tools).length > 0 && { tools, stopWhen }),
  });

  return { fullStream: result.fullStream as AsyncIterable<TextStreamPart> };
}

export type { AISDKAdapterMessage, GenerateTextOptions, GenerateTextResult } from "./types";
export { mapAISDKStreamToChunks, mapAISDKPartToChunk } from "./normalize-ai-sdk-stream";
export type { TextStreamPart } from "./normalize-ai-sdk-stream";

/**
 * Built-in tools capability matrix per provider and model.
 * Used to resolve which native (provider) tools are available and which to enable.
 */

import { getOptimalConfig } from "@/lib/aiServices/configs/provider-configs";

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

/** Built-in tool slugs we use in the adapter and UI (normalized). */
export const BUILTIN_TOOL_SLUGS = {
  web_search: "web_search",
  google_search: "google_search",
  x_search: "x_search",
  code_execution: "code_execution",
  code_interpreter: "code_interpreter",
  file_search: "file_search",
  image_generation: "image_generation",
  computer_use: "computer_use",
  collections_search: "collections_search",
} as const;

export type BuiltInToolSlug = (typeof BUILTIN_TOOL_SLUGS)[keyof typeof BUILTIN_TOOL_SLUGS];

/**
 * Returns the list of built-in tool slugs supported by the given provider and model,
 * based on the provider optimal config. For models not in config, uses provider-level fallback
 * so that e.g. any Claude gets web_search, any Gemini gets google_search.
 */
export function getBuiltInToolsForProvider(provider: string, modelId: string): BuiltInToolSlug[] {
  const norm = normalizeProvider(provider);
  const config = getOptimalConfig(provider, modelId);
  const out: BuiltInToolSlug[] = [];
  const hasModelConfig = config && Object.keys(config).length > 0;

  switch (norm) {
    case "anthropic":
      if (config.webSearch?.enabled || !hasModelConfig) out.push("web_search");
      break;
    case "openai":
      if (config.webSearch?.enabled || !hasModelConfig) out.push("web_search");
      break;
    case "google":
      if (config.googleSearch?.enabled || !hasModelConfig) out.push("google_search");
      break;
    case "xai":
      if (config.search?.webSearch?.enabled || !hasModelConfig) out.push("web_search");
      if (config.search?.xSearch?.enabled || !hasModelConfig) out.push("x_search");
      break;
    case "deepseek":
      break;
    default:
      break;
  }

  return out;
}

export interface BuiltInToolsOptions {
  /** If false, web_search (and google_search) are excluded from the list to enable. */
  webSearchEnabled?: boolean;
}

/**
 * Returns the list of built-in tool slugs to actually enable for this provider+model,
 * after applying user options (e.g. webSearchEnabled).
 */
export function getBuiltInToolsToEnable(
  provider: string,
  modelId: string,
  options: BuiltInToolsOptions = {}
): BuiltInToolSlug[] {
  const list = getBuiltInToolsForProvider(provider, modelId);
  const { webSearchEnabled = true } = options;

  if (webSearchEnabled) return list;

  return list.filter(
    (slug) => slug !== "web_search" && slug !== "google_search"
  );
}

/**
 * Returns combined list of built-in slugs (to enable) plus custom tool names,
 * for display or for deciding what the model can use. Built-in are filtered by options.
 */
export function getAvailableToolNames(
  provider: string,
  modelId: string,
  customToolNames: string[],
  options: BuiltInToolsOptions = {}
): string[] {
  const builtIn = getBuiltInToolsToEnable(provider, modelId, options);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of builtIn) {
    if (!seen.has(s)) {
      seen.add(s);
      result.push(s);
    }
  }
  for (const name of customToolNames) {
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

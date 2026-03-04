/**
 * PromptEnvironment - Prompt as a programmable variable/dataset (Environment ε).
 * Slice, filter, split, query with LLM; cached and model-resolver from same internal package.
 */

import { getAIService } from "@/lib/aiServices";
import { RLMCache, getGlobalCache } from "./cache";
import { resolveModelId, getDefaultModelId, getApiKeyForProvider, normalizeProvider } from "./model-resolver";

export interface PromptSlice {
  content: string;
  startIndex: number;
  endIndex: number;
  metadata?: {
    sectionName?: string;
    chunkIndex?: number;
    totalChunks?: number;
  };
}

export interface QueryResult {
  answer: string;
  sourceSlice: PromptSlice;
  tokens: number;
  fromCache: boolean;
}

export interface EnvironmentConfig {
  maxSliceTokens: number;
  defaultChunkSize: number;
  enableCache: boolean;
  modelId: string;
  provider: string;
  apiKey?: string;
}

const DEFAULT_ENV_CONFIG: EnvironmentConfig = {
  maxSliceTokens: 4000,
  defaultChunkSize: 2000,
  enableCache: true,
  modelId: getDefaultModelId(),
  provider: "openai",
};

export class PromptEnvironment {
  private prompt: string;
  private config: EnvironmentConfig;
  private cache: RLMCache;
  private variables: Map<string, unknown> = new Map();
  private sliceHistory: PromptSlice[] = [];

  constructor(prompt: string, config: Partial<EnvironmentConfig> = {}) {
    this.prompt = prompt;
    this.config = { ...DEFAULT_ENV_CONFIG, ...config };
    this.cache = getGlobalCache();
  }

  get length(): number {
    return this.prompt.length;
  }
  get estimatedTokens(): number {
    return Math.ceil(this.prompt.length / 4);
  }
  get raw(): string {
    return this.prompt;
  }

  slice(start: number, end?: number): PromptSlice {
    const actualEnd = end ?? this.prompt.length;
    const content = this.prompt.slice(start, actualEnd);
    const slice: PromptSlice = { content, startIndex: start, endIndex: actualEnd };
    this.sliceHistory.push(slice);
    return slice;
  }
  head(chars: number): PromptSlice {
    return this.slice(0, chars);
  }
  tail(chars: number): PromptSlice {
    return this.slice(Math.max(0, this.prompt.length - chars));
  }
  chunk(index: number, chunkSize?: number): PromptSlice {
    const size = chunkSize ?? this.config.defaultChunkSize;
    const start = index * size;
    const end = Math.min(start + size, this.prompt.length);
    const totalChunks = Math.ceil(this.prompt.length / size);
    const slice = this.slice(start, end);
    slice.metadata = { chunkIndex: index, totalChunks };
    return slice;
  }
  chunks(chunkSize?: number): PromptSlice[] {
    const size = chunkSize ?? this.config.defaultChunkSize;
    const totalChunks = Math.ceil(this.prompt.length / size);
    return Array.from({ length: totalChunks }, (_, i) => this.chunk(i, size));
  }

  split(delimiter: string | RegExp): PromptSlice[] {
    const regex =
      typeof delimiter === "string"
        ? new RegExp(delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
        : new RegExp(delimiter.source, delimiter.flags.includes("g") ? delimiter.flags : delimiter.flags + "g");
    const slices: PromptSlice[] = [];
    let lastIndex = 0;
    let chunkIndex = 0;
    const matches = [...this.prompt.matchAll(regex)];
    for (const match of matches) {
      const matchIndex = match.index!;
      slices.push({
        content: this.prompt.slice(lastIndex, matchIndex),
        startIndex: lastIndex,
        endIndex: matchIndex,
        metadata: { sectionName: `Part ${chunkIndex + 1}`, chunkIndex, totalChunks: matches.length + 1 },
      });
      lastIndex = matchIndex + match[0].length;
      chunkIndex++;
    }
    slices.push({
      content: this.prompt.slice(lastIndex),
      startIndex: lastIndex,
      endIndex: this.prompt.length,
      metadata: { sectionName: `Part ${chunkIndex + 1}`, chunkIndex, totalChunks: matches.length + 1 },
    });
    return slices;
  }

  splitBySections(pattern: RegExp): PromptSlice[] {
    const source = pattern.source;
    if (source.length > 500 || /(\[.*\]|\(.*\))[*+?]/.test(source)) {
      throw new Error("Invalid or potentially dangerous regex pattern provided to splitBySections.");
    }
    const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
    const regex = new RegExp(pattern.source, flags);
    const matches = [...this.prompt.matchAll(regex)];
    const slices: PromptSlice[] = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const startIndex = match.index!;
      const endIndex = i < matches.length - 1 ? matches[i + 1].index! : this.prompt.length;
      slices.push({
        content: this.prompt.slice(startIndex, endIndex),
        startIndex,
        endIndex,
        metadata: { sectionName: match[0], chunkIndex: i, totalChunks: matches.length },
      });
    }
    return slices;
  }

  filter(keyword: string, contextChars: number = 500): PromptSlice[] {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedKeyword, "gi");
    const matches = [...this.prompt.matchAll(regex)];
    return matches.map((match, i) => {
      const matchIndex = match.index!;
      const startIndex = Math.max(0, matchIndex - contextChars);
      const endIndex = Math.min(this.prompt.length, matchIndex + keyword.length + contextChars);
      return {
        content: this.prompt.slice(startIndex, endIndex),
        startIndex,
        endIndex,
        metadata: { sectionName: `Match ${i + 1}: "${keyword}"` },
      };
    });
  }

  findSection(keyword: string, sectionPattern: RegExp = /\n\n+/): PromptSlice | null {
    const index = this.prompt.indexOf(keyword);
    if (index === -1) return null;
    const sections = this.split(sectionPattern);
    return sections.find((s) => s.startIndex <= index && s.endIndex >= index) ?? null;
  }

  async query(
    queryTemplate: string,
    slice?: PromptSlice,
    options?: { skipCache?: boolean }
  ): Promise<QueryResult> {
    const targetSlice = slice ?? this.slice(0, this.config.maxSliceTokens * 4);
    if (this.config.enableCache && !options?.skipCache) {
      const cacheHash = this.cache.generateHash(queryTemplate, targetSlice.content.substring(0, 200));
      const cached = this.cache.get(cacheHash);
      if (cached) {
        return {
          answer: cached.answer,
          sourceSlice: targetSlice,
          tokens: 0,
          fromCache: true,
        };
      }
    }
    const sliceInfo = targetSlice.metadata?.sectionName ? `Section: ${targetSlice.metadata.sectionName}\n` : "";
    const systemPrompt = `You are analyzing a portion of a larger document. Answer questions based ONLY on the provided content.

${sliceInfo}CONTENT:
"""
${targetSlice.content}
"""

Answer concisely and accurately.`;
    const provider = normalizeProvider(this.config.provider);
    const apiKey = getApiKeyForProvider(this.config.provider, this.config.apiKey);
    const service = getAIService(provider, apiKey);
    const response = await service.generateResponse({
      model: resolveModelId(this.config.modelId),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: queryTemplate },
      ],
      temperature: 0.3,
    });
    const result: QueryResult = {
      answer: response.content,
      sourceSlice: targetSlice,
      tokens: response.tokens,
      fromCache: false,
    };
    if (this.config.enableCache) {
      const cacheHash = this.cache.generateHash(queryTemplate, targetSlice.content.substring(0, 200));
      this.cache.set(cacheHash, {
        answer: result.answer,
        confidence: 1,
        sourceQuery: queryTemplate,
        tokensUsed: response.tokens,
        fromCache: false,
      });
    }
    return result;
  }

  async queryAll(queryTemplate: string, slices: PromptSlice[], concurrency: number = 3): Promise<QueryResult[]> {
    const results: QueryResult[] = new Array(slices.length);
    for (let i = 0; i < slices.length; i += concurrency) {
      const batch = slices.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (slice, batchIndex) => {
          results[i + batchIndex] = await this.query(queryTemplate, slice);
        })
      );
    }
    return results;
  }

  async mapReduce(
    mapQuery: string,
    reduceQuery: string,
    slices?: PromptSlice[]
  ): Promise<{ results: QueryResult[]; aggregated: string }> {
    const targetSlices = slices ?? this.chunks();
    const results = await this.queryAll(mapQuery, targetSlices);
    const mapResults = results.map((r, i) => `[Result ${i + 1}]: ${r.answer}`).join("\n\n");
    const reduceSlice: PromptSlice = {
      content: mapResults,
      startIndex: 0,
      endIndex: mapResults.length,
      metadata: { sectionName: "Aggregated Results" },
    };
    const aggregatedResult = await this.query(reduceQuery, reduceSlice);
    return { results, aggregated: aggregatedResult.answer };
  }

  setVar(name: string, value: unknown): void {
    this.variables.set(name, value);
  }
  getVar<T = unknown>(name: string): T | undefined {
    return this.variables.get(name) as T | undefined;
  }
  getAllVars(): Record<string, unknown> {
    return Object.fromEntries(this.variables);
  }

  getSummary(): {
    promptLength: number;
    estimatedTokens: number;
    slicesCreated: number;
    variablesSet: number;
  } {
    return {
      promptLength: this.prompt.length,
      estimatedTokens: this.estimatedTokens,
      slicesCreated: this.sliceHistory.length,
      variablesSet: this.variables.size,
    };
  }
}

export function createEnvironment(prompt: string, config?: Partial<EnvironmentConfig>): PromptEnvironment {
  return new PromptEnvironment(prompt, config);
}

export function createEnvironmentFromContext(
  items: Array<{ content: string; role?: string }>,
  config?: Partial<EnvironmentConfig>
): PromptEnvironment {
  const combined = items
    .map((item, i) => `[${item.role?.toUpperCase() || "CONTEXT"} ${i + 1}]\n${item.content}`)
    .join("\n\n---\n\n");
  return new PromptEnvironment(combined, config);
}

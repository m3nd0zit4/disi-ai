/**
 * PromptEnvironment - Prompt as a programmable variable/dataset
 * 
 * Implements the "Environment ε" concept from the RLM diagram.
 * Prompt is treated as an external memory that can be:
 * - Sliced (prompt[:100])
 * - Filtered (by keyword, by section)
 * - Split (prompt.split("Chapter"))
 * - Queried (llm_query on a slice)
 * - Cached (memoized queries)
 * 
 * The model never receives the full prompt unless strictly necessary.
 */

import { getAIService } from "@/lib/aiServices";
import { RLMCache, getGlobalCache } from "./cache";

// =============================================================================
// Types
// =============================================================================

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
  /** Max tokens per slice for LLM query */
  maxSliceTokens: number;
  /** Default chunk size for splitting */
  defaultChunkSize: number;
  /** Enable caching of query results */
  enableCache: boolean;
  /** Model to use for queries */
  modelId: string;
  /** Provider */
  provider: string;
  /** API key (optional, falls back to env) */
  apiKey?: string;
}

const DEFAULT_ENV_CONFIG: EnvironmentConfig = {
  maxSliceTokens: 4000,
  defaultChunkSize: 2000,
  enableCache: true,
  modelId: "gpt-4o",
  provider: "openai",
};

// =============================================================================
// PromptEnvironment Class
// =============================================================================

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

  // ===========================================================================
  // Core Properties
  // ===========================================================================

  /** Get full prompt length */
  get length(): number {
    return this.prompt.length;
  }

  /** Estimate token count */
  get estimatedTokens(): number {
    return Math.ceil(this.prompt.length / 4);
  }

  /** Get raw prompt (use sparingly) */
  get raw(): string {
    return this.prompt;
  }

  // ===========================================================================
  // Slice Operations
  // ===========================================================================

  /**
   * Slice the prompt by character index
   * Equivalent to: prompt[start:end]
   */
  slice(start: number, end?: number): PromptSlice {
    const actualEnd = end ?? this.prompt.length;
    const content = this.prompt.slice(start, actualEnd);
    
    const slice: PromptSlice = {
      content,
      startIndex: start,
      endIndex: actualEnd,
    };
    
    this.sliceHistory.push(slice);
    return slice;
  }

  /**
   * Get first N characters
   */
  head(chars: number): PromptSlice {
    return this.slice(0, chars);
  }

  /**
   * Get last N characters
   */
  tail(chars: number): PromptSlice {
    return this.slice(Math.max(0, this.prompt.length - chars));
  }

  /**
   * Get a chunk by index (0-based)
   */
  chunk(index: number, chunkSize?: number): PromptSlice {
    const size = chunkSize ?? this.config.defaultChunkSize;
    const start = index * size;
    const end = Math.min(start + size, this.prompt.length);
    const totalChunks = Math.ceil(this.prompt.length / size);
    
    const slice = this.slice(start, end);
    slice.metadata = {
      chunkIndex: index,
      totalChunks,
    };
    
    return slice;
  }

  /**
   * Get all chunks
   */
  chunks(chunkSize?: number): PromptSlice[] {
    const size = chunkSize ?? this.config.defaultChunkSize;
    const totalChunks = Math.ceil(this.prompt.length / size);
    const result: PromptSlice[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      result.push(this.chunk(i, size));
    }
    
    return result;
  }

  // ===========================================================================
  // Split Operations
  // ===========================================================================

  /**
   * Split prompt by delimiter
   * Equivalent to: prompt.split(delimiter)
   */
  split(delimiter: string | RegExp): PromptSlice[] {
    const parts = this.prompt.split(delimiter);
    const slices: PromptSlice[] = [];
    let currentIndex = 0;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const startIndex = this.prompt.indexOf(part, currentIndex);
      const endIndex = startIndex + part.length;
      
      slices.push({
        content: part,
        startIndex,
        endIndex,
        metadata: {
          sectionName: `Part ${i + 1}`,
          chunkIndex: i,
          totalChunks: parts.length,
        },
      });
      
      currentIndex = endIndex;
    }
    
    return slices;
  }

  /**
   * Split by section markers (e.g., "Chapter 1", "Chapter 2")
   */
  splitBySections(pattern: RegExp): PromptSlice[] {
    const matches = [...this.prompt.matchAll(new RegExp(pattern, 'g'))];
    const slices: PromptSlice[] = [];
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const startIndex = match.index!;
      const endIndex = i < matches.length - 1 
        ? matches[i + 1].index! 
        : this.prompt.length;
      
      slices.push({
        content: this.prompt.slice(startIndex, endIndex),
        startIndex,
        endIndex,
        metadata: {
          sectionName: match[0],
          chunkIndex: i,
          totalChunks: matches.length,
        },
      });
    }
    
    return slices;
  }

  // ===========================================================================
  // Filter Operations
  // ===========================================================================

  /**
   * Find slices containing keyword
   */
  filter(keyword: string, contextChars: number = 500): PromptSlice[] {
    const regex = new RegExp(keyword, 'gi');
    const matches = [...this.prompt.matchAll(regex)];
    
    return matches.map((match, i) => {
      const matchIndex = match.index!;
      const startIndex = Math.max(0, matchIndex - contextChars);
      const endIndex = Math.min(this.prompt.length, matchIndex + keyword.length + contextChars);
      
      return {
        content: this.prompt.slice(startIndex, endIndex),
        startIndex,
        endIndex,
        metadata: {
          sectionName: `Match ${i + 1}: "${keyword}"`,
        },
      };
    });
  }

  /**
   * Find section containing keyword
   */
  findSection(keyword: string, sectionPattern: RegExp = /\n\n+/): PromptSlice | null {
    const index = this.prompt.indexOf(keyword);
    if (index === -1) return null;
    
    const sections = this.split(sectionPattern);
    return sections.find(s => s.startIndex <= index && s.endIndex >= index) || null;
  }

  // ===========================================================================
  // Query Operations (LLM calls on slices)
  // ===========================================================================

  /**
   * Query a slice with the LLM
   * Equivalent to: llm_query(f"In {slice}, find...")
   */
  async query(
    queryTemplate: string,
    slice?: PromptSlice,
    options?: { skipCache?: boolean }
  ): Promise<QueryResult> {
    const targetSlice = slice ?? this.slice(0, this.config.maxSliceTokens * 4);
    
    // Check cache
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

    // Build prompt with slice
    const sliceInfo = targetSlice.metadata?.sectionName 
      ? `Section: ${targetSlice.metadata.sectionName}\n` 
      : '';
    
    const systemPrompt = `You are analyzing a portion of a larger document. Answer questions based ONLY on the provided content.

${sliceInfo}CONTENT:
"""
${targetSlice.content}
"""

Answer concisely and accurately.`;

    // Call LLM
    const provider = this.config.provider;
    const apiKey = this.config.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || "";
    const service = getAIService(provider, apiKey);

    const response = await service.generateResponse({
      model: this.config.modelId,
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

    // Cache result
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

  /**
   * Query multiple slices in parallel
   */
  async queryAll(
    queryTemplate: string,
    slices: PromptSlice[]
  ): Promise<QueryResult[]> {
    return Promise.all(
      slices.map(slice => this.query(queryTemplate, slice))
    );
  }

  /**
   * Map-reduce pattern: query all sections, then aggregate
   */
  async mapReduce(
    mapQuery: string,
    reduceQuery: string,
    slices?: PromptSlice[]
  ): Promise<{ results: QueryResult[]; aggregated: string }> {
    const targetSlices = slices ?? this.chunks();
    
    // Map phase
    const results = await this.queryAll(mapQuery, targetSlices);
    
    // Reduce phase
    const mapResults = results.map((r, i) => 
      `[Result ${i + 1}]: ${r.answer}`
    ).join('\n\n');
    
    const reduceSlice: PromptSlice = {
      content: mapResults,
      startIndex: 0,
      endIndex: mapResults.length,
      metadata: { sectionName: "Aggregated Results" },
    };
    
    const aggregatedResult = await this.query(reduceQuery, reduceSlice);
    
    return {
      results,
      aggregated: aggregatedResult.answer,
    };
  }

  // ===========================================================================
  // Variable Storage
  // ===========================================================================

  /**
   * Set a variable (like pre_cata, post_cata in the diagram)
   */
  setVar(name: string, value: unknown): void {
    this.variables.set(name, value);
  }

  /**
   * Get a variable
   */
  getVar<T = unknown>(name: string): T | undefined {
    return this.variables.get(name) as T | undefined;
  }

  /**
   * Get all variables
   */
  getAllVars(): Record<string, unknown> {
    return Object.fromEntries(this.variables);
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  /**
   * Get summary of environment state
   */
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

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a PromptEnvironment from text
 */
export function createEnvironment(
  prompt: string,
  config?: Partial<EnvironmentConfig>
): PromptEnvironment {
  return new PromptEnvironment(prompt, config);
}

/**
 * Create from ReasoningContext items
 */
export function createEnvironmentFromContext(
  items: Array<{ content: string; role?: string }>,
  config?: Partial<EnvironmentConfig>
): PromptEnvironment {
  const combined = items
    .map((item, i) => `[${item.role?.toUpperCase() || 'CONTEXT'} ${i + 1}]\n${item.content}`)
    .join('\n\n---\n\n');
  
  return new PromptEnvironment(combined, config);
}

/**
 * RLM Cache - In-memory caching for query results
 * 
 * Caches are keyed by hash of (query + context slice).
 * Prevents redundant LLM calls for identical queries.
 */

import { CachedResult, WorkerResult } from "./types";

export class RLMCache {
  private cache: Map<string, CachedResult> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Generate a deterministic hash for a query + context pair
   */
  generateHash(query: string, contextSlice: string): string {
    // Simple hash function (could use crypto for production)
    const str = `${query}::${contextSlice}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `rlm_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Get a cached result if it exists
   */
  get(queryHash: string): WorkerResult | undefined {
    const cached = this.cache.get(queryHash);
    if (cached) {
      return { ...cached.result, fromCache: true };
    }
    return undefined;
  }

  /**
   * Store a result in the cache
   */
  set(queryHash: string, result: WorkerResult): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(queryHash, {
      result,
      timestamp: Date.now(),
      hash: queryHash,
    });
  }

  /**
   * Check if a query is cached
   */
  has(queryHash: string): boolean {
    return this.cache.has(queryHash);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance for shared use
let globalCache: RLMCache | null = null;

export function getGlobalCache(): RLMCache {
  if (!globalCache) {
    globalCache = new RLMCache(100);
  }
  return globalCache;
}

export function clearGlobalCache(): void {
  if (globalCache) {
    globalCache.clear();
  }
}

/**
 * RLM Cache - In-memory caching for query results
 *
 * Caches are keyed by hash of (query + context slice).
 * Prevents redundant LLM calls for identical queries.
 */

import { CachedResult, WorkerResult } from "../types";

export class RLMCache {
  private cache: Map<string, CachedResult> = new Map();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttl: number = 1000 * 60 * 60) {
    // Default 1 hour TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  generateHash(query: string, contextSlice: string): string {
    const str = `${query}::${contextSlice}`;
    let h1 = 0xdeadbeef,
      h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `rlm_${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)}`;
  }

  get(queryHash: string): WorkerResult | undefined {
    const cached = this.cache.get(queryHash);
    if (cached) {
      const isExpired = Date.now() - cached.timestamp > this.ttl;
      if (isExpired) {
        this.cache.delete(queryHash);
        return undefined;
      }
      this.cache.delete(queryHash);
      this.cache.set(queryHash, cached);
      return { ...cached.result, fromCache: true };
    }
    return undefined;
  }

  set(queryHash: string, result: WorkerResult): void {
    if (this.cache.has(queryHash)) {
      this.cache.delete(queryHash);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(queryHash, { result, timestamp: Date.now(), hash: queryHash });
  }

  has(queryHash: string): boolean {
    const cached = this.cache.get(queryHash);
    if (cached) {
      if (Date.now() - cached.timestamp > this.ttl) {
        this.cache.delete(queryHash);
        return false;
      }
      return true;
    }
    return false;
  }

  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }

  clear(): void {
    this.cache.clear();
  }
}

let globalCache: RLMCache | null = null;

export function getGlobalCache(): RLMCache {
  if (!globalCache) globalCache = new RLMCache(100);
  return globalCache;
}

export function clearGlobalCache(): void {
  if (globalCache) globalCache.clear();
}

/**
 * Search Strategy Module
 *
 * Provides query expansion and retry logic for improved web search results.
 * When a single query returns no results, this module generates alternative
 * queries to increase the chance of finding relevant information.
 */

export interface SearchStrategy {
  queries: string[];
  maxRetries: number;
  currentAttempt: number;
}

/**
 * Generate multiple search queries from a single user query.
 * Uses various expansion strategies to improve search coverage.
 */
export function generateSearchQueries(originalQuery: string): string[] {
  const queries: string[] = [originalQuery];
  const lowerQuery = originalQuery.toLowerCase();

  // Remove temporal words that may limit results
  const temporalWords = /\b(today|hoy|ahora|now|yesterday|ayer|this week|esta semana)\b/gi;
  const withoutTemporal = originalQuery.replace(temporalWords, '').trim().replace(/\s+/g, ' ');
  if (withoutTemporal && withoutTemporal !== originalQuery && withoutTemporal.length > 10) {
    queries.push(withoutTemporal);
  }

  // Add year context for current events
  const currentYear = new Date().getFullYear();
  if (!originalQuery.includes(String(currentYear))) {
    queries.push(`${originalQuery} ${currentYear}`);
  }

  // For Spanish queries, add English variant
  if (/[áéíóúñ¿¡]/i.test(originalQuery)) {
    queries.push(`${originalQuery} english`);
  }

  // For news/current events queries
  const newsKeywords = /\b(news|noticias|actualidad|update|meeting|summit|reunion|reunión|election|elección)\b/i;
  if (newsKeywords.test(lowerQuery)) {
    queries.push(`${originalQuery} latest news`);
    queries.push(`${originalQuery} official`);
  }

  // For political/government queries
  const politicalKeywords = /\b(trump|biden|president|presidente|government|gobierno|minister|ministro|congress|congreso)\b/i;
  if (politicalKeywords.test(lowerQuery)) {
    queries.push(`${originalQuery} official statement`);
    queries.push(`${originalQuery} press release`);
  }

  // For technology queries
  const techKeywords = /\b(api|software|app|code|programming|developer|release|version|update)\b/i;
  if (techKeywords.test(lowerQuery)) {
    queries.push(`${originalQuery} documentation`);
    queries.push(`${originalQuery} announcement`);
  }

  // For research/academic queries
  const researchKeywords = /\b(research|study|paper|science|scientific|data|analysis)\b/i;
  if (researchKeywords.test(lowerQuery)) {
    queries.push(`${originalQuery} research paper`);
    queries.push(`${originalQuery} peer reviewed`);
  }

  // Deduplicate and limit to 5 queries max
  const uniqueQueries = [...new Set(queries.map(q => q.trim()))].filter(q => q.length > 5);
  return uniqueQueries.slice(0, 5);
}

/**
 * Determine if search should be retried with a different query.
 */
export function shouldRetrySearch(
  resultsCount: number,
  currentAttempt: number,
  maxRetries: number
): boolean {
  // Retry if no results and haven't exhausted attempts
  return resultsCount === 0 && currentAttempt < maxRetries;
}

/**
 * Create a search strategy for a given query.
 */
export function createSearchStrategy(query: string, maxRetries: number = 3): SearchStrategy {
  return {
    queries: generateSearchQueries(query),
    maxRetries,
    currentAttempt: 0,
  };
}

/**
 * Get the next query to try from a strategy.
 * Returns null if all queries have been exhausted.
 */
export function getNextQuery(strategy: SearchStrategy): string | null {
  if (strategy.currentAttempt >= strategy.queries.length) {
    return null;
  }
  return strategy.queries[strategy.currentAttempt];
}

/**
 * Advance the strategy to the next query.
 */
export function advanceStrategy(strategy: SearchStrategy): SearchStrategy {
  return {
    ...strategy,
    currentAttempt: strategy.currentAttempt + 1,
  };
}

/**
 * Check if the strategy has more queries to try.
 */
export function hasMoreQueries(strategy: SearchStrategy): boolean {
  return strategy.currentAttempt < strategy.queries.length - 1;
}

/**
 * Get a human-readable description of the current search attempt.
 */
export function getSearchAttemptDescription(strategy: SearchStrategy): string {
  const current = strategy.currentAttempt + 1;
  const total = strategy.queries.length;
  const query = strategy.queries[strategy.currentAttempt] || '';

  if (current === 1) {
    return `Searching: "${query}"`;
  }
  return `Search attempt ${current}/${total}: "${query}"`;
}

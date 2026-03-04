/**
 * Zod schemas for tool outputs (Tool UI pattern: schema-first rendering).
 *
 * When a tool result matches a schema, the toolkit renders a dedicated component.
 * When it doesn't, parsing fails safely (safeParse → null) and the UI falls back to generic JSON.
 *
 * @see https://www.tool-ui.com/docs/overview
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Search results (web_search, google_search, etc.)
// ---------------------------------------------------------------------------

const SearchResultItemSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  snippet: z.string().optional(),
  domain: z.string().optional(),
  favicon: z.string().optional(),
});

export const SearchResultsSchema = z.object({
  query: z.string().optional(),
  results: z.array(SearchResultItemSchema).optional().default([]),
  resultsCount: z.number().optional(),
});

export type SearchResultsOutput = z.infer<typeof SearchResultsSchema>;

export function safeParseSearchResults(data: unknown): SearchResultsOutput | null {
  const parsed = SearchResultsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Time display (get_current_time)
// ---------------------------------------------------------------------------

export const TimeDisplaySchema = z.object({
  time: z.string().optional(),
  date: z.string().optional(),
  dayOfWeek: z.string().optional(),
  timezone: z.string().optional(),
});

export type TimeDisplayOutput = z.infer<typeof TimeDisplaySchema>;

export function safeParseTimeDisplay(data: unknown): TimeDisplayOutput | null {
  const parsed = TimeDisplaySchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Calculator result
// ---------------------------------------------------------------------------

export const CalculatorResultSchema = z.object({
  result: z.number(),
  expression: z.string().optional(),
});

export type CalculatorResultOutput = z.infer<typeof CalculatorResultSchema>;

export function safeParseCalculatorResult(data: unknown): CalculatorResultOutput | null {
  const parsed = CalculatorResultSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Text stats
// ---------------------------------------------------------------------------

export const TextStatsSchema = z.object({
  length: z.number(),
  wordCount: z.number(),
  lineCount: z.number(),
});

export type TextStatsOutput = z.infer<typeof TextStatsSchema>;

export function safeParseTextStats(data: unknown): TextStatsOutput | null {
  const parsed = TextStatsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

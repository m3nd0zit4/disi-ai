/**
 * AI Tools - Main Index
 *
 * Exports all tool definitions organized by provider.
 *
 * @architecture
 * ```
 * tools/
 * ├── providers/
 * │   ├── anthropic.ts    - Claude tools
 * │   ├── openai.ts       - GPT tools
 * │   ├── google.ts       - Gemini tools
 * │   ├── xai.ts          - Grok tools
 * │   └── index.ts
 * ├── types.ts            - Base types
 * └── index.ts            - This file
 * ```
 *
 * @date 2026-01-25
 */

// Types
export * from "./types";

// Provider tools
export * from "./providers";

// Re-export all tools info for convenience
import { CLAUDE_TOOLS_INFO } from "./providers/anthropic";
import { OPENAI_TOOLS_INFO } from "./providers/openai";
import { GEMINI_TOOLS_INFO, GEMINI_AGENTS_INFO } from "./providers/google";
import { GROK_TOOLS_INFO } from "./providers/xai";

/**
 * All provider tools combined
 */
export const ALL_TOOLS_INFO = {
    claude: CLAUDE_TOOLS_INFO,
    openai: OPENAI_TOOLS_INFO,
    gemini: GEMINI_TOOLS_INFO,
    geminiAgents: GEMINI_AGENTS_INFO,
    grok: GROK_TOOLS_INFO,
} as const;

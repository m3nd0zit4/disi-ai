/**
 * Tools - Type Definitions
 *
 * Base interfaces and types for AI provider tools.
 *
 * @date 2026-01-25
 */

/**
 * Base interface for tool information across all providers.
 * T is the union of string literals for the tool IDs.
 */
export interface BaseToolInfo<T extends string = string> {
    id: T;
    name: string;
    description: string;
    useCases: string[];
    docsUrl: string;
    isPreview?: boolean;
    isAgent?: boolean;
}

/**
 * All possible tool IDs across providers
 */
export type UniversalToolId =
    // Common tools
    | "webSearch"
    | "fileSearch"
    | "functionCalling"
    | "codeExecution"
    | "computerUse"
    | "mcp"
    // OpenAI specific
    | "imageGeneration"
    | "codeInterpreter"
    | "applyPatch"
    | "shell"
    // Claude specific
    | "textEditor"
    | "webFetch"
    // Gemini specific
    | "googleSearch"
    | "googleMaps"
    | "urlContext"
    // Grok specific
    | "xSearch"
    | "imageUnderstanding"
    | "collectionsSearch"
    | "documentSearch";

/**
 * Tool category for grouping
 */
export type ToolCategory =
    | "search"        // Web search, file search, etc.
    | "code"          // Code execution, interpreter
    | "generation"    // Image/video generation
    | "integration"   // MCP, function calling
    | "computer"      // Computer use, shell
    | "document";     // Document/file handling

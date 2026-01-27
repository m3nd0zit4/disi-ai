/**
 * xAI Grok Tools
 *
 * Tool definitions for Grok models.
 *
 * @provider xAI
 * @date 2026-01-25
 */

import { BaseToolInfo } from "../types";

export type GrokToolId =
    | "webSearch"
    | "xSearch"
    | "codeExecution"
    | "imageUnderstanding"
    | "collectionsSearch"
    | "mcp"
    | "documentSearch";

export type GrokToolInfo = BaseToolInfo<GrokToolId>;

export const GROK_TOOLS_INFO: Record<GrokToolId, GrokToolInfo> = {
    webSearch: {
        id: "webSearch",
        name: "Web Search",
        description: "Real-time search across the internet with the ability to both search the web and browse web pages.",
        useCases: [
            "Researching current events",
            "Retrieving up-to-date information"
        ],
        docsUrl: "https://docs.x.ai/docs/guides/tools/search-tools"
    },
    xSearch: {
        id: "xSearch",
        name: "X Search",
        description: "Semantic and keyword search across X posts, users, and threads.",
        useCases: [
            "Analyzing social media trends",
            "Finding specific posts or users on X"
        ],
        docsUrl: "https://docs.x.ai/docs/guides/tools/search-tools"
    },
    codeExecution: {
        id: "codeExecution",
        name: "Code Execution",
        description: "Write and execute Python code for calculations, data analysis, and complex computations.",
        useCases: [
            "Data analysis",
            "Complex mathematical calculations",
            "Running Python scripts"
        ],
        docsUrl: "https://docs.x.ai/docs/guides/tools/code-execution-tool"
    },
    imageUnderstanding: {
        id: "imageUnderstanding",
        name: "Image/Video Understanding",
        description: "Visual content understanding and analysis for search results encountered.",
        useCases: [
            "Analyzing images in search results",
            "Understanding video content from X posts"
        ],
        docsUrl: "https://docs.x.ai/docs/guides/tools/search-tools#parameter-enable_image_understanding-supported-by-web-search-and-x-search"
    },
    collectionsSearch: {
        id: "collectionsSearch",
        name: "Collections Search",
        description: "Search through your uploaded knowledge bases and collections to retrieve relevant information.",
        useCases: [
            "Retrieving information from personal knowledge bases",
            "Searching custom collections"
        ],
        docsUrl: "https://docs.x.ai/docs/guides/tools/collections-search-tool"
    },
    mcp: {
        id: "mcp",
        name: "Remote MCP Tools",
        description: "Connect to external MCP servers to access custom tools.",
        useCases: [
            "Integrating with third-party services",
            "Extending capabilities with custom tools"
        ],
        docsUrl: "https://docs.x.ai/docs/guides/tools/remote-mcp-tools"
    },
    documentSearch: {
        id: "documentSearch",
        name: "Document Search",
        description: "Upload files and chat with them using intelligent document search.",
        useCases: [
            "Analyzing uploaded documents",
            "Extracting information from files"
        ],
        docsUrl: "https://docs.x.ai/docs/guides/files"
    }
};

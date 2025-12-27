export type GeminiToolId = 
  | "googleSearch"
  | "googleMaps"
  | "codeExecution"
  | "urlContext"
  | "computerUse"
  | "fileSearch"
  | "functionCalling";

export type GeminiAgentId = 
  | "deepResearch";

export interface ToolInfo {
  id: GeminiToolId | GeminiAgentId;
  name: string;
  description: string;
  useCases: string[];
  docsUrl: string;
  isAgent?: boolean;
  isPreview?: boolean;
}

export const GEMINI_TOOLS_INFO: Record<GeminiToolId, ToolInfo> = {
  googleSearch: {
    id: "googleSearch",
    name: "Google Search",
    description: "Ground responses in current events and facts from the web to reduce hallucinations.",
    useCases: [
      "Answering questions about recent events",
      "Verifying facts with diverse sources"
    ],
    docsUrl: "https://ai.google.dev/gemini-api/docs/google-search"
  },
  googleMaps: {
    id: "googleMaps",
    name: "Google Maps",
    description: "Build location-aware assistants that can find places, get directions, and provide rich local context.",
    useCases: [
      "Planning travel itineraries with multiple stops",
      "Finding local businesses based on user criteria"
    ],
    docsUrl: "https://ai.google.dev/gemini-api/docs/maps-grounding"
  },
  codeExecution: {
    id: "codeExecution",
    name: "Code Execution",
    description: "Allow the model to write and run Python code to solve math problems or process data accurately.",
    useCases: [
      "Solving complex mathematical equations",
      "Processing and analyzing text data precisely"
    ],
    docsUrl: "https://ai.google.dev/gemini-api/docs/code-execution"
  },
  urlContext: {
    id: "urlContext",
    name: "URL Context",
    description: "Direct the model to read and analyze content from specific web pages or documents.",
    useCases: [
      "Answering questions based on specific URLs or documents",
      "Retrieving information across different web pages"
    ],
    docsUrl: "https://ai.google.dev/gemini-api/docs/url-context"
  },
  computerUse: {
    id: "computerUse",
    name: "Computer Use",
    description: "Enable Gemini to view a screen and generate actions to interact with web browser UIs (Client-side execution).",
    useCases: [
      "Automating repetitive web-based workflows",
      "Testing web application user interfaces"
    ],
    docsUrl: "https://ai.google.dev/gemini-api/docs/computer-use",
    isPreview: true
  },
  fileSearch: {
    id: "fileSearch",
    name: "File Search",
    description: "Index and search your own documents to enable Retrieval Augmented Generation (RAG).",
    useCases: [
      "Searching technical manuals",
      "Question answering over proprietary data"
    ],
    docsUrl: "https://ai.google.dev/gemini-api/docs/file-search"
  },
  functionCalling: {
    id: "functionCalling",
    name: "Function Calling",
    description: "Connect models to external tools and systems that you define.",
    useCases: [
      "Interacting with internal APIs",
      "Performing custom actions based on model output"
    ],
    docsUrl: "https://ai.google.dev/gemini-api/docs/function-calling"
  }
};

export const GEMINI_AGENTS_INFO: Record<GeminiAgentId, ToolInfo> = {
  deepResearch: {
    id: "deepResearch",
    name: "Deep Research",
    description: "Autonomously plans, executes, and synthesizes multi-step research tasks.",
    useCases: [
      "Market analysis",
      "Due diligence",
      "Literature reviews"
    ],
    docsUrl: "https://ai.google.dev/gemini-api/docs/deep-research",
    isAgent: true
  }
};

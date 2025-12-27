import { BaseToolInfo } from "./base-tools";

export type ClaudeToolId = 
  | "computerUse"
  | "textEditor"
  | "webSearch"
  | "webFetch"
  | "mcp"
  | "functionCalling";

export type ClaudeToolInfo = BaseToolInfo<ClaudeToolId>;


export type ToolInfo = ClaudeToolInfo;


export const CLAUDE_TOOLS_INFO: Record<ClaudeToolId, ToolInfo> = {
  computerUse: {
    id: "computerUse",
    name: "Computer Use",
    description: "Create agentic workflows that enable a model to control a computer interface.",
    useCases: [
      "Automating repetitive web-based workflows",
      "Testing web application user interfaces"
    ],
    docsUrl: "https://docs.anthropic.com/en/agents-and-tools/tool-use/computer-use-tool",
    isPreview: true
  },
  textEditor: {
    id: "textEditor",
    name: "Text Editor",
    description: "Allow the model to view, create, and edit files.",
    useCases: [
      "Modifying codebases",
      "Writing and editing documents"
    ],
    docsUrl: "https://docs.anthropic.com/en/agents-and-tools/tool-use/text-editor-tool"
  },
  webSearch: {
    id: "webSearch",
    name: "Web Search",
    description: "Perform web searches to retrieve up-to-date information.",
    useCases: [
      "Researching current events",
      "Fact-checking information"
    ],
    docsUrl: "https://docs.anthropic.com/en/agents-and-tools/tool-use/web-search-tool"
  },
  webFetch: {
    id: "webFetch",
    name: "Web Fetch",
    description: "Retrieve and analyze content from specific URLs.",
    useCases: [
      "Summarizing web pages",
      "Extracting data from websites"
    ],
    docsUrl: "https://docs.anthropic.com/en/agents-and-tools/tool-use/web-fetch-tool"
  },
  mcp: {
    id: "mcp",
    name: "Model Context Protocol (MCP)",
    description: "Connect to remote MCP servers to extend capabilities.",
    useCases: [
      "Integrating with internal tools",
      "Accessing custom data sources"
    ],
    docsUrl: "https://modelcontextprotocol.io"
  },
  functionCalling: {
    id: "functionCalling",
    name: "Function Calling",
    description: "Define custom tools for Claude to use.",
    useCases: [
      "Interacting with APIs",
      "Performing custom logic"
    ],
    docsUrl: "https://docs.anthropic.com/en/docs/tool-use"
  }
};

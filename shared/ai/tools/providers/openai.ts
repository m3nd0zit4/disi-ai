/**
 * OpenAI GPT Tools
 *
 * Tool definitions for GPT models.
 *
 * @provider OpenAI
 * @date 2026-01-25
 */

import { BaseToolInfo } from "../types";

export type OpenAIToolId =
    | "webSearch"
    | "fileSearch"
    | "functionCalling"
    | "mcp"
    | "imageGeneration"
    | "codeInterpreter"
    | "computerUse"
    | "applyPatch"
    | "shell";

export type OpenAIToolInfo = BaseToolInfo<OpenAIToolId>;

export const OPENAI_TOOLS_INFO: Record<OpenAIToolId, OpenAIToolInfo> = {
    webSearch: {
        id: "webSearch",
        name: "Web Search",
        description: "Include data from the Internet in model response generation.",
        useCases: [
            "Retrieving relevant, up-to-date information",
            "Answering questions beyond the model's training cutoff"
        ],
        docsUrl: "https://platform.openai.com/docs/guides/tools-web-search"
    },
    fileSearch: {
        id: "fileSearch",
        name: "File Search",
        description: "Search the contents of uploaded files for context when generating a response.",
        useCases: [
            "Retrieving information from specific documents",
            "Contextualizing answers with user data"
        ],
        docsUrl: "https://platform.openai.com/docs/guides/tools-file-search"
    },
    functionCalling: {
        id: "functionCalling",
        name: "Function Calling",
        description: "Call custom code to give the model access to additional data and capabilities.",
        useCases: [
            "Calling application code",
            "Accessing specific data not in the model"
        ],
        docsUrl: "https://platform.openai.com/docs/guides/function-calling"
    },
    mcp: {
        id: "mcp",
        name: "Remote MCP Servers",
        description: "Give the model access to new capabilities via Model Context Protocol (MCP) servers.",
        useCases: [
            "Accessing third-party services",
            "Extending capabilities with remote tools"
        ],
        docsUrl: "https://platform.openai.com/docs/guides/tools-remote-mcp"
    },
    imageGeneration: {
        id: "imageGeneration",
        name: "Image Generation",
        description: "Generate or edit images using GPT Image.",
        useCases: [
            "Creating visual assets",
            "Editing existing images"
        ],
        docsUrl: "https://platform.openai.com/docs/guides/tools-image-generation"
    },
    codeInterpreter: {
        id: "codeInterpreter",
        name: "Code Interpreter",
        description: "Allow the model to execute code in a secure container.",
        useCases: [
            "Data analysis",
            "Solving mathematical problems",
            "Running Python code"
        ],
        docsUrl: "https://platform.openai.com/docs/guides/tools-code-interpreter"
    },
    computerUse: {
        id: "computerUse",
        name: "Computer Use",
        description: "Create agentic workflows that enable a model to control a computer interface.",
        useCases: [
            "Automating computer tasks",
            "Controlling UI elements"
        ],
        docsUrl: "https://platform.openai.com/docs/guides/tools-computer-use"
    },
    applyPatch: {
        id: "applyPatch",
        name: "Apply Patch",
        description: "Allow models to propose structured diffs that your integration applies.",
        useCases: [
            "Code refactoring",
            "Applying code changes"
        ],
        docsUrl: "https://platform.openai.com/docs/guides/tools-apply-patch"
    },
    shell: {
        id: "shell",
        name: "Shell",
        description: "Allow models to run shell commands through your integration.",
        useCases: [
            "System administration tasks",
            "Running command-line tools"
        ],
        docsUrl: "https://platform.openai.com/docs/guides/tools-shell"
    }
};

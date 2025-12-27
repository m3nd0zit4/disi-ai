import { InputModality, OutputModality } from "./common";

// ============================================================================
// ANTHROPIC (CLAUDE) METADATA
// ============================================================================

export interface ClaudeMetadata {
  // Model capabilities
  contextWindow: number;              // e.g., 200000
  maxOutputTokens: number;            // e.g., 4096
  knowledgeCutoff?: string;
  
  // Modalities
  inputModalities: InputModality[];   // ["text", "image"]
  outputModalities: OutputModality[]; // ["text"]
  
  // Features
  features?: {
    streaming: boolean;
    systemPrompts: boolean;
    functionCalling: boolean;
    promptCaching: boolean;
    extendedThinking?: boolean;
  };

  // Tools
  tools?: {
    computerUse: boolean;
    textEditor: boolean;
    webSearch: boolean;
    webFetch: boolean;
    mcp: boolean;
    functionCalling: boolean; // Included here for consistency with other providers
  };
  
  // Pricing
  pricing?: {
    inputPerMillion: number;
    outputPerMillion: number;
    cacheWritePerMillion?: number;
    cacheReadPerMillion?: number;
  };
}

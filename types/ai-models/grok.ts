import { InputModality, OutputModality } from "./common";

// ============================================================================
// XAI (GROK) METADATA
// ============================================================================

export interface GrokMetadata {
  // Model capabilities
  contextWindow: number;              // e.g., 128000
  maxOutputTokens: number;
  
  // Modalities
  inputModalities: InputModality[];   // ["text", "image"]
  outputModalities: OutputModality[]; // ["text"]
  
  // Features
  features?: {
    streaming: boolean;
    functionCalling: boolean;
    twitterAccess: boolean;           // Real-time access to X data
  };

  // Tools
  tools?: {
    webSearch: boolean;
    xSearch: boolean;
    codeExecution: boolean;
    imageUnderstanding: boolean;
    collectionsSearch: boolean;
    mcp: boolean;
    documentSearch: boolean;
  };
  
  // Pricing
  pricing?: {
    inputPerMillion: number;
    cachedInputPerMillion?: number;
    outputPerMillion: number;
    imageGenerationPerImage?: {
      Standard?: Record<string, number>;
    };
  };

  // Image Generation Options
  imageGenerationOptions?: {
    supportsTextGeneration: boolean;
  };
}

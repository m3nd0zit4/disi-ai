import { InputModality, OutputModality } from "./common";

// ============================================================================
// DEEPSEEK METADATA
// ============================================================================

export interface DeepSeekMetadata {
  // Model capabilities
  contextWindow: number;              // e.g., 64000
  maxOutputTokens: number;
  
  // Modalities
  inputModalities: InputModality[];   // ["text"]
  outputModalities: OutputModality[]; // ["text"]
  
  // Features
  features?: {
    streaming: boolean;
    functionCalling: boolean;
    chatPrefixCompletion: boolean;    // Beta feature
    fimCompletion: boolean;           // Beta feature (Fill-In-the-Middle)
  };
  
  // Pricing
  pricing?: {
    inputPerMillion: number;
    cachedInputPerMillion?: number;   // Cache hit price
    outputPerMillion: number;
  };
}

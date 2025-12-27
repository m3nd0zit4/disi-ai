import { InputModality, OutputModality } from "./common";

// ============================================================================
// OPENAI (GPT) METADATA
// ============================================================================

export interface OpenAIMetadata {
  // Model capabilities
  contextWindow: number;              // e.g., 400000
  maxOutputTokens: number;            // e.g., 128000
  knowledgeCutoff?: string;           // e.g., "May 31, 2024"
  
  // Modalities
  inputModalities: InputModality[];   // ["text", "image"]
  outputModalities: OutputModality[]; // ["text"]
  
  // Endpoints supported
  endpoints: {
    chatCompletions: boolean;
    responses: boolean;
    realtime: boolean;
    assistants: boolean;
    batch: boolean;
    fineTuning: boolean;
    embeddings: boolean;
    imageGeneration: boolean;
    videos: boolean;
    imageEdit: boolean;
    speechGeneration: boolean;
    transcription: boolean;
    translation: boolean;
    moderation: boolean;
  };
  
  // Features (OpenAI specific) - Optional for video generation models
  features?: {
    streaming?: boolean;
    functionCalling?: boolean;
    structuredOutputs?: boolean;
    batchAPI?: boolean;
    reasoningTokenSupport?: boolean;
    distillation?: boolean;
    fineTuning?: boolean;
  };
  
  // Tools (for Responses API) - Optional for video generation models
  tools?: {
    webSearch: boolean;
    fileSearch: boolean;
    imageGeneration: boolean;
    codeInterpreter: boolean;
    computerUse: boolean;
    mcp: boolean;
  };
  
  // Snapshots
  snapshots?: string[];               // e.g., ["gpt-5-mini-2025-08-07"]
  
  // Pricing (per 1M tokens or per second for video)
  pricing: {
    inputPerMillion: number;          // e.g., 0.25
    cachedInputPerMillion?: number;   // e.g., 0.025
    outputPerMillion: number;         // e.g., 2.00
    // For video generation - can be single price or resolution-based tiers
    videoGenerationPerSecond?: number | {
      "720p": number;                 // e.g., 0.30 for Sora 2 Pro
      "1080p": number;                // e.g., 0.50 for Sora 2 Pro
    };
    // For image generation - detailed pricing by quality and resolution
    imageGenerationPerImage?: {
      Low?: {
        "1024x1024"?: number;         // e.g., 0.009
        "1024x1536"?: number;         // e.g., 0.013
        "1536x1024"?: number;         // e.g., 0.013
      };
      Medium?: {
        "1024x1024"?: number;         // e.g., 0.034
        "1024x1536"?: number;         // e.g., 0.05
        "1536x1024"?: number;         // e.g., 0.05
      };
      High?: {
        "1024x1024"?: number;         // e.g., 0.133
        "1024x1536"?: number;         // e.g., 0.20
        "1536x1024"?: number;         // e.g., 0.20
      };
    };
  };
  
  // For image generation models
  imageGenerationOptions?: {
    sizes?: string[];                 // e.g., ["1024x1024", "1024x1792"]
    quality?: ("standard" | "hd")[];
  };
  
  // For video generation models (Sora)
  videoGenerationOptions?: {
    aspectRatios: string[];           // e.g., ["720x1280", "1280x720"]
    resolutions: string[];            // e.g., ["720p", "1080p"]
    maxDuration: number;              // Maximum duration in seconds
    audioGeneration: boolean;         // Sora 2/2 Pro generates synced audio
    snapshots?: string[];             // Available model snapshots
  };
}

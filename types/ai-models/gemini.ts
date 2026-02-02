import { InputModality, OutputModality } from "./common";

// ============================================================================
// GOOGLE GEMINI METADATA
// ============================================================================

export interface GeminiMetadata {
  // Model capabilities
  contextWindow: number;              // e.g., 1048576 (1M tokens)
  maxOutputTokens: number;            // e.g., 65536
  knowledgeCutoff?: string;           // e.g., "January 2025"
  latestUpdate?: string;              // e.g., "December 2025"
  
  // Native multimodal
  inputModalities: InputModality[];   // ["text", "image", "audio", "video", "pdf"]
  outputModalities: OutputModality[]; // ["text"] or ["text", "image"] for image gen models
  
  // General Capabilities
  capabilities: {
    audioGeneration: boolean;
    imageGeneration: boolean;
    videoGeneration?: boolean;        // Added for clarity
    batchAPI: boolean;
    caching: boolean;
    liveAPI: boolean;
    thinking: boolean;                // Deep Think mode
    structuredOutputs: boolean;
  };
  
  // Built-in Tools & Integrations
  tools: {
    googleSearch: boolean;            // Ground responses in current events
    googleMaps: boolean;              // Location-aware assistants
    codeExecution: boolean;           // Python code execution
    urlContext: boolean;              // Read and analyze content from URLs
    computerUse: boolean;             // Interact with web browser UIs (Preview)
    fileSearch: boolean;              // RAG with user documents
    functionCalling: boolean;         // Custom tools
  };
  
  // Available Agents
  agents: {
    deepResearch: boolean;            // Autonomously plans and executes research
  };
  
  // For image generation models (Nano Banana)
  imageGenerationOptions?: {
    modelType?: string;
    sizes?: string[];
    quality?: string[];
    n?: number[];
    modelName: "Nano Banana" | "Nano Banana Pro";
    aspectRatios: {
      ratio: string;                  // e.g., "1:1", "16:9"
      resolution: string;             // e.g., "1024x1024", "2048x2048"
      tokens: number;                 // Token cost for this resolution
    }[];
    resolutionTiers?: ("1K" | "2K" | "4K")[]; // For Nano Banana Pro
    supportsTextGeneration: boolean;  // Gemini image models also generate text
  };
  
  // For video generation models (Veo)
  videoGenerationOptions?: {
    modelName: string;                // e.g., "Veo 3.1", "Veo 3.1 Fast"
    aspectRatios: string[];           // e.g., ["16:9", "9:16"]
    resolutions: string[];            // e.g., ["720p", "1080p"]
    durationSeconds: number[];        // e.g., [4, 6, 8]
    features: {
      textToVideo: boolean;
      imageToVideo: boolean;          // Animate initial image
      videoExtension: boolean;        // Extend existing video
      interpolation: boolean;         // Transition between two images
      referenceImages: boolean;       // Style/content references (Veo 3.1 only)
      audioCues: boolean;             // Supports audio cues in prompt
      negativePrompt: boolean;
    };
    personGeneration: ("allow_all" | "allow_adult" | "dont_allow")[];
  };
  
  // Pricing
  pricing?: {
    inputPerMillion?: number;
    outputPerMillion?: number;
    free?: boolean;                   // Some models have free tier
  };
}

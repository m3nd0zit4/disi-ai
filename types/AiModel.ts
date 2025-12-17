/**
 * Types for the specialized models system
 * 
 * Categories:
 * - reasoning: Models (orquestadores)
 * - image: Image generation
 * - video: Video generation
 */

export type ModelCategory = 
  | "reasoning"   // Reasoning models (orquestadores)
  | "image"       // Image generation
  | "video";      // Video generation

export type Provider = 
  | "GPT" 
  | "Claude" 
  | "Gemini" 
  | "Grok" 
  | "DeepSeek";

/**
 * Specialized model
 */
export interface SpecializedModel {
  id: string;                    // Unique identifier
  category: ModelCategory;       // Model type
  provider: Provider;            // Provider
  providerModelId: string;       // Model ID in the provider API
  name: string;                  // Name to display
  description: string;           // Brief description
  premium: boolean;              // Requires PRO plan
  enabled: boolean;              // Enabled
  icon: {
    light: string;
    dark: string;
  };                  // Provider icon
  metadata?: {
    qualityResolutions?: string[];      // For images/video
    aspectRatios?: string[];     // For images/video
    maxDuration?: number;        // For video (seconds)
    supportedFormats?: string[]; // Supported formats
  };
}

/**
 * Selected model configuration by the user
 */
export interface SelectedModel {
  category: ModelCategory;
  modelId: string;               // ID of the SpecializedModel
  provider: Provider;
  providerModelId: string;
}

/**
 * Generic model response
 */
export interface ModelResponseData {
  id: string;
  category: ModelCategory;
  modelId: string;
  provider: Provider;
  status: "pending" | "processing" | "completed" | "error";
  isExpanded: boolean;
  
  // For reasoning
  content?: string;
  
  // For image/video
  mediaUrl?: string;
  mediaType?: "image" | "video";
  
  // Metrics
  responseTime?: number;
  tokens?: number;
  cost?: number;
  error?: string;
}

/**
 * User capabilities
 * (Based on selected reasoning models)
 */
export interface UserCapabilities {
  reasoning: SpecializedModel[];  // Selected reasoning models
  image: SpecializedModel[];      // Available image models
  video: SpecializedModel[];      // Available video models
}
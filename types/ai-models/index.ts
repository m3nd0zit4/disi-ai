import { ModelCategory, Provider } from "./common";
import { OpenAIMetadata } from "./openai";
import { GeminiMetadata } from "./gemini";
import { ClaudeMetadata } from "./claude";
import { GrokMetadata } from "./grok";
import { DeepSeekMetadata } from "./deepseek";

export * from "./common";
export * from "./openai";
export * from "./gemini";
export * from "./claude";
export * from "./grok";
export * from "./deepseek";

// ============================================================================
// PROVIDER METADATA (Discriminated Union)
// ============================================================================

export type ProviderMetadata =
  | { provider: "GPT"; metadata: OpenAIMetadata }
  | { provider: "Gemini"; metadata: GeminiMetadata }
  | { provider: "Claude"; metadata: ClaudeMetadata }
  | { provider: "Grok"; metadata: GrokMetadata }
  | { provider: "DeepSeek"; metadata: DeepSeekMetadata };

// ============================================================================
// SPECIALIZED MODEL
// ============================================================================

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
  };
  
  // Provider-specific metadata (discriminated union)
  providerMetadata: ProviderMetadata;
  
  // Legacy metadata (deprecated, kept for backward compatibility)
  metadata?: {
    qualityResolutions?: string[];
    aspectRatios?: string[];
    maxDuration?: number;
    supportedFormats?: string[];
  };
}

// ============================================================================
// SELECTED MODEL
// ============================================================================

export interface SelectedModel {
  category: ModelCategory;
  modelId: string;               // ID of the SpecializedModel
  provider: Provider;
  providerModelId: string;
  isEnabled: boolean;            // Whether the model is active
  specializedModels?: string[];  // IDs of specialized models (image/video) for this instance
}

// ============================================================================
// MODEL RESPONSE DATA
// ============================================================================

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

// ============================================================================
// USER CAPABILITIES
// ============================================================================

export interface UserCapabilities {
  reasoning: SpecializedModel[];  // Selected reasoning models
  image: SpecializedModel[];      // Available image models
  video: SpecializedModel[];      // Available video models
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isOpenAIModel(model: SpecializedModel): model is SpecializedModel & { providerMetadata: { provider: "GPT"; metadata: OpenAIMetadata } } {
  return model.provider === "GPT";
}

export function isGeminiModel(model: SpecializedModel): model is SpecializedModel & { providerMetadata: { provider: "Gemini"; metadata: GeminiMetadata } } {
  return model.provider === "Gemini";
}

export function isClaudeModel(model: SpecializedModel): model is SpecializedModel & { providerMetadata: { provider: "Claude"; metadata: ClaudeMetadata } } {
  return model.provider === "Claude";
}

export function isGrokModel(model: SpecializedModel): model is SpecializedModel & { providerMetadata: { provider: "Grok"; metadata: GrokMetadata } } {
  return model.provider === "Grok";
}

export function isDeepSeekModel(model: SpecializedModel): model is SpecializedModel & { providerMetadata: { provider: "DeepSeek"; metadata: DeepSeekMetadata } } {
  return model.provider === "DeepSeek";
}

/**
 * Common types for the AI model system
 */

export type ModelCategory = 
  | "reasoning"   // Reasoning models (orquestadores)
  | "standard"    // Standard chat models
  | "image"       // Image generation
  | "video";      // Video generation

export type Provider = 
  | "GPT" 
  | "Claude" 
  | "Gemini" 
  | "Grok" 
  | "DeepSeek";

// ============================================================================
// MODALITIES
// ============================================================================

export type InputModality = "text" | "image" | "audio" | "video" | "pdf";
export type OutputModality = "text" | "image" | "audio" | "video";

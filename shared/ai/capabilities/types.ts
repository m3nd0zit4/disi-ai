/**
 * Model Capabilities Layer
 *
 * @architecture-decision
 * Los modelos se organizan por capacidad funcional, NO por proveedor.
 * La UI consume capacidades, el proveedor es un detalle de implementación.
 *
 * @date 2026-01-25
 */

/**
 * Capacidades funcionales de los modelos
 * Cada modelo puede tener una o más capacidades
 */
export type ModelCapability =
  // === Text Capabilities ===
  | "text.chat"           // Conversación general
  | "text.reasoning"      // Razonamiento complejo, multi-step thinking
  | "text.summarization"  // Resúmenes y condensación de información
  | "text.coding"         // Generación, edición y análisis de código
  | "text.analysis"       // Análisis de documentos y datos
  | "text.translation"    // Traducción entre idiomas

  // === Image Capabilities ===
  | "image.generation"    // Generar imágenes desde texto (DALL-E, etc.)
  | "image.understanding" // Entender, describir y analizar imágenes
  | "image.editing"       // Editar imágenes existentes

  // === Video Capabilities ===
  | "video.generation"    // Generar videos desde texto (Sora, Veo, etc.)
  | "video.understanding" // Analizar y describir videos

  // === Audio Capabilities ===
  | "audio.transcription" // Speech-to-text (Whisper, etc.)
  | "audio.speech"        // Text-to-speech
  | "audio.understanding" // Analizar contenido de audio

  // === Combined ===
  | "multimodal";         // Combina múltiples modalidades nativamente

/**
 * Categorías de alto nivel para agrupar capacidades
 */
export type CapabilityCategory =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "multimodal";

/**
 * Extrae la categoría de una capacidad
 */
export function getCapabilityCategory(capability: ModelCapability): CapabilityCategory {
  if (capability === "multimodal") return "multimodal";
  const [category] = capability.split(".") as [CapabilityCategory];
  return category;
}

/**
 * Metadatos de cada capacidad para la UI
 */
export interface CapabilityInfo {
  id: ModelCapability;
  displayName: string;
  description: string;
  category: CapabilityCategory;
  icon: string;
}

/**
 * Registro de información de capacidades
 */
export const CAPABILITY_INFO: Record<ModelCapability, CapabilityInfo> = {
  // Text
  "text.chat": {
    id: "text.chat",
    displayName: "Chat",
    description: "General conversation and Q&A",
    category: "text",
    icon: "message-circle",
  },
  "text.reasoning": {
    id: "text.reasoning",
    displayName: "Reasoning",
    description: "Complex multi-step thinking and analysis",
    category: "text",
    icon: "brain",
  },
  "text.summarization": {
    id: "text.summarization",
    displayName: "Summarization",
    description: "Condense and summarize content",
    category: "text",
    icon: "file-text",
  },
  "text.coding": {
    id: "text.coding",
    displayName: "Coding",
    description: "Code generation, editing, and debugging",
    category: "text",
    icon: "code",
  },
  "text.analysis": {
    id: "text.analysis",
    displayName: "Analysis",
    description: "Document and data analysis",
    category: "text",
    icon: "search",
  },
  "text.translation": {
    id: "text.translation",
    displayName: "Translation",
    description: "Translate between languages",
    category: "text",
    icon: "languages",
  },

  // Image
  "image.generation": {
    id: "image.generation",
    displayName: "Image Generation",
    description: "Create images from text descriptions",
    category: "image",
    icon: "image-plus",
  },
  "image.understanding": {
    id: "image.understanding",
    displayName: "Image Understanding",
    description: "Analyze and describe images",
    category: "image",
    icon: "eye",
  },
  "image.editing": {
    id: "image.editing",
    displayName: "Image Editing",
    description: "Edit and modify existing images",
    category: "image",
    icon: "edit-3",
  },

  // Video
  "video.generation": {
    id: "video.generation",
    displayName: "Video Generation",
    description: "Create videos from text descriptions",
    category: "video",
    icon: "video",
  },
  "video.understanding": {
    id: "video.understanding",
    displayName: "Video Understanding",
    description: "Analyze and describe video content",
    category: "video",
    icon: "film",
  },

  // Audio
  "audio.transcription": {
    id: "audio.transcription",
    displayName: "Transcription",
    description: "Convert speech to text",
    category: "audio",
    icon: "mic",
  },
  "audio.speech": {
    id: "audio.speech",
    displayName: "Speech",
    description: "Convert text to speech",
    category: "audio",
    icon: "volume-2",
  },
  "audio.understanding": {
    id: "audio.understanding",
    displayName: "Audio Understanding",
    description: "Analyze audio content",
    category: "audio",
    icon: "headphones",
  },

  // Multimodal
  "multimodal": {
    id: "multimodal",
    displayName: "Multimodal",
    description: "Works with multiple content types natively",
    category: "multimodal",
    icon: "layers",
  },
};

/**
 * Obtiene todas las capacidades de una categoría
 */
export function getCapabilitiesByCategory(category: CapabilityCategory): ModelCapability[] {
  return Object.values(CAPABILITY_INFO)
    .filter(info => info.category === category)
    .map(info => info.id);
}

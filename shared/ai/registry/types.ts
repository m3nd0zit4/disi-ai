/**
 * Model Registry Types
 *
 * @architecture-decision
 * RegisteredModel es la interfaz canónica para definir modelos.
 * Todos los modelos deben cumplir este contrato independientemente del proveedor.
 *
 * @date 2026-01-25
 */

import { ModelCapability } from "../capabilities/types";

// =============================================================================
// ENUMS AND BASIC TYPES
// =============================================================================

/**
 * Proveedores de modelos (detalle de implementación)
 * La UI NO debe mostrar esto directamente
 */
export type Provider =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "deepseek";

/**
 * Mapeo de nombres de provider legacy a nuevos
 */
export const PROVIDER_LEGACY_MAP: Record<string, Provider> = {
  "Claude": "anthropic",
  "GPT": "openai",
  "Gemini": "google",
  "Grok": "xai",
  "DeepSeek": "deepseek",
};

/**
 * Información de display para proveedores (solo para UI avanzada)
 */
export const PROVIDER_INFO: Record<Provider, { displayName: string; icon: string }> = {
  anthropic: { displayName: "Anthropic", icon: "/icons/claude.svg" },
  openai: { displayName: "OpenAI", icon: "/icons/openai.svg" },
  google: { displayName: "Google", icon: "/icons/gemini.svg" },
  xai: { displayName: "xAI", icon: "/icons/grok.svg" },
  deepseek: { displayName: "DeepSeek", icon: "/icons/deepseek.svg" },
};

/**
 * Tier de costo relativo
 * Usado para filtrar y mostrar indicadores de costo en la UI
 */
export type CostTier = "free" | "low" | "medium" | "high" | "premium";

/**
 * Tier de velocidad relativa
 * Usado para mostrar indicadores de velocidad en la UI
 */
export type SpeedTier = "instant" | "fast" | "medium" | "slow";

/**
 * Orden numérico de velocidad (para sorting)
 */
export const SPEED_ORDER: Record<SpeedTier, number> = {
  instant: 0,
  fast: 1,
  medium: 2,
  slow: 3,
};

/**
 * Orden numérico de costo (para sorting)
 */
export const COST_ORDER: Record<CostTier, number> = {
  free: 0,
  low: 1,
  medium: 2,
  high: 3,
  premium: 4,
};

// =============================================================================
// MODALITIES
// =============================================================================

/**
 * Tipos de input que acepta un modelo
 */
export type InputModality = "text" | "image" | "audio" | "video" | "pdf";

/**
 * Tipos de output que puede generar un modelo
 */
export type OutputModality = "text" | "image" | "audio" | "video";

// =============================================================================
// FEATURES AND TOOLS
// =============================================================================

/**
 * Features técnicas que soporta un modelo
 */
export interface ModelFeatures {
  streaming: boolean;
  functionCalling: boolean;
  structuredOutputs: boolean;
  extendedThinking: boolean;
  promptCaching: boolean;
  systemPrompts: boolean;
}

/**
 * Herramientas que soporta un modelo
 */
export interface ModelTools {
  webSearch: boolean;
  codeExecution: boolean;
  fileSearch: boolean;
  computerUse: boolean;
  mcp: boolean;
  imageGeneration: boolean;
}

/**
 * Valores por defecto para features
 */
export const DEFAULT_FEATURES: ModelFeatures = {
  streaming: true,
  functionCalling: false,
  structuredOutputs: false,
  extendedThinking: false,
  promptCaching: false,
  systemPrompts: true,
};

/**
 * Valores por defecto para tools
 */
export const DEFAULT_TOOLS: ModelTools = {
  webSearch: false,
  codeExecution: false,
  fileSearch: false,
  computerUse: false,
  mcp: false,
  imageGeneration: false,
};

// =============================================================================
// PRICING
// =============================================================================

/**
 * Información de pricing (solo para backend/cálculos)
 */
export interface ModelPricing {
  inputPerMillion?: number;
  outputPerMillion?: number;
  cachedInputPerMillion?: number;
  cacheWritePerMillion?: number;
  cacheReadPerMillion?: number;
  imageGenerationPerImage?: Record<string, number>;
  videoGenerationPerSecond?: Record<string, number>;
}

// =============================================================================
// REGISTERED MODEL (MAIN INTERFACE)
// =============================================================================

/**
 * Modelo registrado en el sistema
 *
 * Esta es la interfaz canónica. Todo modelo en el sistema
 * debe poder expresarse con esta estructura.
 */
export interface RegisteredModel {
  // === Identification ===
  /** ID único interno (e.g., "claude-sonnet-4-5") */
  id: string;

  /** ID que usa el API del proveedor (e.g., "claude-sonnet-4-5-20250929") */
  providerModelId: string;

  /** Proveedor del modelo */
  provider: Provider;

  // === Display ===
  /** Nombre para mostrar al usuario */
  displayName: string;

  /** Descripción corta para la UI */
  description: string;

  /** Iconos para light/dark mode */
  icon: {
    light: string;
    dark: string;
  };

  // === Capabilities (Core Concept) ===
  /** Todas las capacidades que tiene el modelo */
  capabilities: ModelCapability[];

  /** Capacidad principal (para categorización) */
  primaryCapability: ModelCapability;

  // === Modalities ===
  /** Tipos de input que acepta */
  inputModalities: InputModality[];

  /** Tipos de output que genera */
  outputModalities: OutputModality[];

  // === Classification ===
  /** Tier de costo relativo */
  costTier: CostTier;

  /** Tier de velocidad relativa */
  speedTier: SpeedTier;

  // === Technical Limits ===
  /** Ventana de contexto en tokens */
  contextWindow: number;

  /** Máximo de tokens de output */
  maxOutputTokens: number;

  /** Fecha de corte de conocimiento */
  knowledgeCutoff?: string;

  // === Features & Tools ===
  /** Features técnicas soportadas */
  features: ModelFeatures;

  /** Herramientas soportadas */
  tools: ModelTools;

  // === Control ===
  /** Si el modelo está habilitado para uso */
  enabled: boolean;

  /** Si requiere plan premium */
  requiresPremium: boolean;

  /** Si es un modelo legacy/deprecado */
  isLegacy: boolean;

  /** Fecha de deprecación (si aplica) */
  deprecationDate?: string;

  /** Modelo recomendado para reemplazar este (si es legacy) */
  replacedBy?: string;

  // === Provider-Specific Metadata ===
  /** Metadata específica del proveedor (pricing, endpoints, etc.) */
  _providerMetadata?: {
    pricing?: ModelPricing;
    [key: string]: unknown;
  };
}

// =============================================================================
// QUERY TYPES
// =============================================================================

/**
 * Filtros para buscar modelos
 */
export interface ModelFilters {
  capabilities?: ModelCapability[];
  providers?: Provider[];
  costTiers?: CostTier[];
  speedTiers?: SpeedTier[];
  inputModalities?: InputModality[];
  outputModalities?: OutputModality[];
  requiresPremium?: boolean;
  isLegacy?: boolean;
  enabled?: boolean;
}

/**
 * Opciones de ordenamiento
 */
export type ModelSortBy = "name" | "cost" | "speed" | "contextWindow";
export type ModelSortOrder = "asc" | "desc";

export interface ModelSortOptions {
  by: ModelSortBy;
  order: ModelSortOrder;
}

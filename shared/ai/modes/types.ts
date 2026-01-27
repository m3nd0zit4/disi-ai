/**
 * User Modes Types
 *
 * Los modos abstraen la complejidad de los modelos para el usuario final.
 * La UI muestra "Smart", "Fast", etc. en lugar de IDs técnicos.
 *
 * @architecture-decision
 * Los modos son la capa de abstracción entre el usuario y los modelos.
 * Permiten cambiar el modelo subyacente sin cambiar la UX.
 *
 * @date 2026-01-25
 */

import { ModelCapability } from "../capabilities/types";

/**
 * Modos de usuario disponibles
 */
export type UserMode =
  | "smart"       // Balance between quality and speed
  | "fast"        // Prioritize speed
  | "creative"    // For creative/generative tasks
  | "precise"     // For analytical/precise tasks
  | "research"    // For deep research and analysis
  | "code"        // Optimized for coding tasks
  | "vision"      // For image understanding
  | "generate";   // For content generation (images/video)

/**
 * Configuración de un modo
 */
export interface ModeConfig {
  /** Identificador único del modo */
  id: UserMode;

  /** Nombre para mostrar */
  displayName: string;

  /** Descripción corta */
  description: string;

  /** Icono (nombre de Lucide icon) */
  icon: string;

  /** Si es el modo recomendado */
  isRecommended: boolean;

  /** Si requiere plan premium */
  requiresPremium: boolean;

  /** Si está habilitado */
  enabled: boolean;

  /** Modelo por defecto para este modo */
  defaultModelId: string;

  /** Modelos alternativos (fallback) */
  fallbackModelIds: string[];

  /** Capacidades que prioriza este modo */
  prioritizedCapabilities: ModelCapability[];

  /** Configuración recomendada para este modo */
  recommendedSettings: ModeSettings;

  /** Tags para búsqueda/categorización */
  tags: string[];
}

/**
 * Configuración de parámetros para un modo
 */
export interface ModeSettings {
  /** Temperature recomendada (0-2) */
  temperature?: number;

  /** Max tokens de respuesta */
  maxTokens?: number;

  /** Top P sampling */
  topP?: number;

  /** Frequency penalty */
  frequencyPenalty?: number;

  /** Presence penalty */
  presencePenalty?: number;
}

/**
 * Resultado de seleccionar un modo
 */
export interface ModeSelection {
  /** Modo seleccionado */
  mode: UserMode;

  /** Modelo resuelto para este modo */
  modelId: string;

  /** Configuración a aplicar */
  settings: ModeSettings;
}

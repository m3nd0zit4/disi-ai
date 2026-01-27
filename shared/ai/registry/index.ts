/**
 * Model Registry
 *
 * Punto central de acceso a todos los modelos del sistema.
 * Proporciona métodos de consulta por capacidad, proveedor, etc.
 *
 * @architecture-decision
 * El registry es la única fuente de verdad para modelos.
 * Toda consulta de modelos debe pasar por aquí.
 *
 * @example
 * ```typescript
 * import { modelRegistry } from "@/shared/ai/registry";
 *
 * // Get all reasoning models
 * const reasoningModels = modelRegistry.getByCapability("text.reasoning");
 *
 * // Get recommended model for a capability
 * const recommended = modelRegistry.getRecommendedFor("text.coding");
 * ```
 *
 * @date 2026-01-25
 */

import { ModelCapability, CapabilityCategory, getCapabilityCategory } from "../capabilities/types";
import {
  RegisteredModel,
  Provider,
  CostTier,
  SpeedTier,
  ModelFilters,
  ModelSortOptions,
  SPEED_ORDER,
  COST_ORDER,
} from "./types";
import { getAdaptedModels, invalidateAdaptedModelsCache } from "./adapter";

// =============================================================================
// MODEL REGISTRY CLASS
// =============================================================================

export class ModelRegistry {
  private models: Map<string, RegisteredModel>;
  private modelsByCapability: Map<ModelCapability, RegisteredModel[]>;
  private modelsByProvider: Map<Provider, RegisteredModel[]>;

  constructor() {
    this.models = new Map();
    this.modelsByCapability = new Map();
    this.modelsByProvider = new Map();
    this.loadModels();
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Carga todos los modelos al registry
   */
  private loadModels(): void {
    const adaptedModels = getAdaptedModels();

    for (const model of adaptedModels) {
      this.registerModel(model);
    }
  }

  /**
   * Registra un modelo en el registry
   */
  private registerModel(model: RegisteredModel): void {
    // Add to main map
    this.models.set(model.id, model);

    // Index by capabilities
    for (const capability of model.capabilities) {
      const existing = this.modelsByCapability.get(capability) || [];
      existing.push(model);
      this.modelsByCapability.set(capability, existing);
    }

    // Index by provider
    const providerModels = this.modelsByProvider.get(model.provider) || [];
    providerModels.push(model);
    this.modelsByProvider.set(model.provider, providerModels);
  }

  /**
   * Recarga los modelos (útil para hot-reload o testing)
   */
  public reload(): void {
    this.models.clear();
    this.modelsByCapability.clear();
    this.modelsByProvider.clear();
    invalidateAdaptedModelsCache();
    this.loadModels();
  }

  // ===========================================================================
  // BASIC QUERIES
  // ===========================================================================

  /**
   * Obtiene un modelo por su ID
   */
  public getById(id: string): RegisteredModel | undefined {
    return this.models.get(id);
  }

  /**
   * Obtiene todos los modelos
   */
  public getAll(): RegisteredModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Obtiene todos los modelos habilitados
   */
  public getEnabled(): RegisteredModel[] {
    return this.getAll().filter((m) => m.enabled);
  }

  /**
   * Cuenta total de modelos
   */
  public count(): number {
    return this.models.size;
  }

  // ===========================================================================
  // CAPABILITY QUERIES
  // ===========================================================================

  /**
   * Obtiene modelos por capacidad
   */
  public getByCapability(capability: ModelCapability): RegisteredModel[] {
    return (this.modelsByCapability.get(capability) || []).filter((m) => m.enabled);
  }

  /**
   * Obtiene modelos por categoría de capacidad
   */
  public getByCapabilityCategory(category: CapabilityCategory): RegisteredModel[] {
    const models = new Set<RegisteredModel>();

    for (const [capability, capabilityModels] of this.modelsByCapability) {
      if (getCapabilityCategory(capability) === category) {
        for (const model of capabilityModels) {
          if (model.enabled) {
            models.add(model);
          }
        }
      }
    }

    return Array.from(models);
  }

  /**
   * Verifica si un modelo soporta una capacidad
   */
  public supportsCapability(modelId: string, capability: ModelCapability): boolean {
    const model = this.getById(modelId);
    return model?.capabilities.includes(capability) ?? false;
  }

  /**
   * Obtiene todas las capacidades disponibles
   */
  public getAvailableCapabilities(): ModelCapability[] {
    return Array.from(this.modelsByCapability.keys());
  }

  // ===========================================================================
  // PROVIDER QUERIES
  // ===========================================================================

  /**
   * Obtiene modelos por proveedor
   */
  public getByProvider(provider: Provider): RegisteredModel[] {
    return (this.modelsByProvider.get(provider) || []).filter((m) => m.enabled);
  }

  /**
   * Obtiene todos los proveedores disponibles
   */
  public getAvailableProviders(): Provider[] {
    return Array.from(this.modelsByProvider.keys());
  }

  // ===========================================================================
  // FILTERED QUERIES
  // ===========================================================================

  /**
   * Busca modelos con filtros avanzados
   */
  public query(filters: ModelFilters, sort?: ModelSortOptions): RegisteredModel[] {
    let results = this.getAll();

    // Apply filters
    if (filters.enabled !== undefined) {
      results = results.filter((m) => m.enabled === filters.enabled);
    }

    if (filters.capabilities?.length) {
      results = results.filter((m) =>
        filters.capabilities!.some((cap) => m.capabilities.includes(cap))
      );
    }

    if (filters.providers?.length) {
      results = results.filter((m) => filters.providers!.includes(m.provider));
    }

    if (filters.costTiers?.length) {
      results = results.filter((m) => filters.costTiers!.includes(m.costTier));
    }

    if (filters.speedTiers?.length) {
      results = results.filter((m) => filters.speedTiers!.includes(m.speedTier));
    }

    if (filters.inputModalities?.length) {
      results = results.filter((m) =>
        filters.inputModalities!.some((mod) => m.inputModalities.includes(mod))
      );
    }

    if (filters.outputModalities?.length) {
      results = results.filter((m) =>
        filters.outputModalities!.some((mod) => m.outputModalities.includes(mod))
      );
    }

    if (filters.requiresPremium !== undefined) {
      results = results.filter((m) => m.requiresPremium === filters.requiresPremium);
    }

    if (filters.isLegacy !== undefined) {
      results = results.filter((m) => m.isLegacy === filters.isLegacy);
    }

    // Apply sorting
    if (sort) {
      results = this.sortModels(results, sort);
    }

    return results;
  }

  /**
   * Ordena modelos según criterios
   */
  private sortModels(models: RegisteredModel[], sort: ModelSortOptions): RegisteredModel[] {
    const { by, order } = sort;
    const multiplier = order === "asc" ? 1 : -1;

    return [...models].sort((a, b) => {
      switch (by) {
        case "name":
          return multiplier * a.displayName.localeCompare(b.displayName);
        case "cost":
          return multiplier * (COST_ORDER[a.costTier] - COST_ORDER[b.costTier]);
        case "speed":
          return multiplier * (SPEED_ORDER[a.speedTier] - SPEED_ORDER[b.speedTier]);
        case "contextWindow":
          return multiplier * (a.contextWindow - b.contextWindow);
        default:
          return 0;
      }
    });
  }

  // ===========================================================================
  // RECOMMENDATION QUERIES
  // ===========================================================================

  /**
   * Obtiene el modelo recomendado para una capacidad
   *
   * Prioriza: no-legacy > no-premium > velocidad
   */
  public getRecommendedFor(capability: ModelCapability): RegisteredModel | undefined {
    const models = this.getByCapability(capability);

    if (models.length === 0) return undefined;

    // Sort by recommendation priority
    const sorted = [...models].sort((a, b) => {
      // Prefer non-legacy
      if (a.isLegacy !== b.isLegacy) return a.isLegacy ? 1 : -1;

      // Prefer non-premium
      if (a.requiresPremium !== b.requiresPremium) return a.requiresPremium ? 1 : -1;

      // Prefer faster
      return SPEED_ORDER[a.speedTier] - SPEED_ORDER[b.speedTier];
    });

    return sorted[0];
  }

  /**
   * Obtiene el modelo más rápido para una capacidad
   */
  public getFastestFor(capability: ModelCapability): RegisteredModel | undefined {
    const models = this.getByCapability(capability);

    if (models.length === 0) return undefined;

    return [...models].sort(
      (a, b) => SPEED_ORDER[a.speedTier] - SPEED_ORDER[b.speedTier]
    )[0];
  }

  /**
   * Obtiene el modelo más barato para una capacidad
   */
  public getCheapestFor(capability: ModelCapability): RegisteredModel | undefined {
    const models = this.getByCapability(capability);

    if (models.length === 0) return undefined;

    return [...models].sort(
      (a, b) => COST_ORDER[a.costTier] - COST_ORDER[b.costTier]
    )[0];
  }

  /**
   * Obtiene el modelo con mejor contexto para una capacidad
   */
  public getLargestContextFor(capability: ModelCapability): RegisteredModel | undefined {
    const models = this.getByCapability(capability);

    if (models.length === 0) return undefined;

    return [...models].sort((a, b) => b.contextWindow - a.contextWindow)[0];
  }

  // ===========================================================================
  // UTILITY QUERIES
  // ===========================================================================

  /**
   * Busca modelos por texto en nombre o descripción
   */
  public search(query: string): RegisteredModel[] {
    const lowerQuery = query.toLowerCase();

    return this.getEnabled().filter(
      (m) =>
        m.displayName.toLowerCase().includes(lowerQuery) ||
        m.description.toLowerCase().includes(lowerQuery) ||
        m.id.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Obtiene modelos que pueden generar un tipo de output
   */
  public getByOutputModality(modality: "text" | "image" | "video" | "audio"): RegisteredModel[] {
    return this.getEnabled().filter((m) => m.outputModalities.includes(modality));
  }

  /**
   * Obtiene modelos que aceptan un tipo de input
   */
  public getByInputModality(modality: "text" | "image" | "video" | "audio" | "pdf"): RegisteredModel[] {
    return this.getEnabled().filter((m) => m.inputModalities.includes(modality));
  }

  /**
   * Obtiene estadísticas del registry
   */
  public getStats(): {
    total: number;
    enabled: number;
    byProvider: Record<Provider, number>;
    byCapability: Record<string, number>;
  } {
    const byProvider: Record<string, number> = {};
    const byCapability: Record<string, number> = {};

    for (const [provider, models] of this.modelsByProvider) {
      byProvider[provider] = models.filter((m) => m.enabled).length;
    }

    for (const [capability, models] of this.modelsByCapability) {
      byCapability[capability] = models.filter((m) => m.enabled).length;
    }

    return {
      total: this.count(),
      enabled: this.getEnabled().length,
      byProvider: byProvider as Record<Provider, number>,
      byCapability,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Instancia singleton del registry
 *
 * @example
 * ```typescript
 * import { modelRegistry } from "@/shared/ai/registry";
 * const model = modelRegistry.getById("claude-sonnet-4-5");
 * ```
 */
export const modelRegistry = new ModelRegistry();

// =============================================================================
// EXPORTS
// =============================================================================

export * from "./types";
export { adaptLegacyModel, getAdaptedModels, getModelsForUI, registeredModelToLegacy } from "./adapter";

/**
 * useModelRegistry Hook
 *
 * Hook de React para acceder al Model Registry.
 *
 * @example
 * ```tsx
 * function ModelList() {
 *   const { models, getByCapability } = useModelRegistry();
 *
 *   const reasoningModels = getByCapability("text.reasoning");
 *
 *   return (
 *     <ul>
 *       {reasoningModels.map(model => (
 *         <li key={model.id}>{model.displayName}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 *
 * @date 2026-01-25
 */

"use client";

import { useMemo, useCallback } from "react";
import {
  modelRegistry,
  RegisteredModel,
  Provider,
  ModelFilters,
  ModelSortOptions,
} from "../registry";
import { ModelCapability, CapabilityCategory } from "../capabilities";

export interface UseModelRegistryReturn {
  /** All enabled models */
  models: RegisteredModel[];

  /** Total count of models */
  count: number;

  /** Get model by ID */
  getById: (id: string) => RegisteredModel | undefined;

  /** Get models by capability */
  getByCapability: (capability: ModelCapability) => RegisteredModel[];

  /** Get models by capability category */
  getByCapabilityCategory: (category: CapabilityCategory) => RegisteredModel[];

  /** Get models by provider */
  getByProvider: (provider: Provider) => RegisteredModel[];

  /** Query models with filters */
  query: (filters: ModelFilters, sort?: ModelSortOptions) => RegisteredModel[];

  /** Get recommended model for capability */
  getRecommendedFor: (capability: ModelCapability) => RegisteredModel | undefined;

  /** Get fastest model for capability */
  getFastestFor: (capability: ModelCapability) => RegisteredModel | undefined;

  /** Get cheapest model for capability */
  getCheapestFor: (capability: ModelCapability) => RegisteredModel | undefined;

  /** Search models by text */
  search: (query: string) => RegisteredModel[];

  /** Get available capabilities */
  availableCapabilities: ModelCapability[];

  /** Get available providers */
  availableProviders: Provider[];

  /** Get registry stats */
  stats: ReturnType<typeof modelRegistry.getStats>;
}

/**
 * Hook para acceder al Model Registry
 */
export function useModelRegistry(): UseModelRegistryReturn {
  // Memoize static data
  const models = useMemo(() => modelRegistry.getEnabled(), []);
  const count = useMemo(() => modelRegistry.count(), []);
  const availableCapabilities = useMemo(
    () => modelRegistry.getAvailableCapabilities(),
    []
  );
  const availableProviders = useMemo(
    () => modelRegistry.getAvailableProviders(),
    []
  );
  const stats = useMemo(() => modelRegistry.getStats(), []);

  // Memoize callbacks
  const getById = useCallback(
    (id: string) => modelRegistry.getById(id),
    []
  );

  const getByCapability = useCallback(
    (capability: ModelCapability) => modelRegistry.getByCapability(capability),
    []
  );

  const getByCapabilityCategory = useCallback(
    (category: CapabilityCategory) => modelRegistry.getByCapabilityCategory(category),
    []
  );

  const getByProvider = useCallback(
    (provider: Provider) => modelRegistry.getByProvider(provider),
    []
  );

  const query = useCallback(
    (filters: ModelFilters, sort?: ModelSortOptions) =>
      modelRegistry.query(filters, sort),
    []
  );

  const getRecommendedFor = useCallback(
    (capability: ModelCapability) => modelRegistry.getRecommendedFor(capability),
    []
  );

  const getFastestFor = useCallback(
    (capability: ModelCapability) => modelRegistry.getFastestFor(capability),
    []
  );

  const getCheapestFor = useCallback(
    (capability: ModelCapability) => modelRegistry.getCheapestFor(capability),
    []
  );

  const search = useCallback(
    (searchQuery: string) => modelRegistry.search(searchQuery),
    []
  );

  return {
    models,
    count,
    getById,
    getByCapability,
    getByCapabilityCategory,
    getByProvider,
    query,
    getRecommendedFor,
    getFastestFor,
    getCheapestFor,
    search,
    availableCapabilities,
    availableProviders,
    stats,
  };
}

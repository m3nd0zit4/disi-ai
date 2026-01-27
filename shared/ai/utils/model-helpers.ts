/**
 * Model Helpers
 *
 * Funciones de utilidad para trabajar con modelos.
 *
 * @date 2026-01-25
 */

import { modelRegistry, RegisteredModel, Provider } from "../registry";
import { ModelCapability } from "../capabilities";

// =============================================================================
// MODEL SELECTION HELPERS
// =============================================================================

/**
 * Obtiene el mejor modelo disponible para una tarea
 */
export function getBestModelFor(options: {
  capability: ModelCapability;
  preferFast?: boolean;
  preferCheap?: boolean;
  preferPremium?: boolean;
  excludeProviders?: Provider[];
  excludeModels?: string[];
}): RegisteredModel | undefined {
  let models = modelRegistry.getByCapability(options.capability);

  // Apply exclusions
  if (options.excludeProviders?.length) {
    models = models.filter((m) => !options.excludeProviders!.includes(m.provider));
  }

  if (options.excludeModels?.length) {
    models = models.filter((m) => !options.excludeModels!.includes(m.id));
  }

  if (models.length === 0) return undefined;

  // Sort based on preferences
  if (options.preferFast) {
    return modelRegistry.getFastestFor(options.capability);
  }

  if (options.preferCheap) {
    return modelRegistry.getCheapestFor(options.capability);
  }

  if (options.preferPremium) {
    const premium = models.filter((m) => m.requiresPremium);
    if (premium.length > 0) {
      return premium[0];
    }
  }

  return modelRegistry.getRecommendedFor(options.capability);
}

/**
 * Obtiene modelos compatibles para una conversación multimodal
 */
export function getMultimodalModels(requiredInputs: Array<"text" | "image" | "audio" | "video" | "pdf">): RegisteredModel[] {
  return modelRegistry.getEnabled().filter((model) =>
    requiredInputs.every((input) => model.inputModalities.includes(input))
  );
}

/**
 * Verifica si un modelo puede manejar un archivo
 */
export function canHandleFile(modelId: string, fileType: string): boolean {
  const model = modelRegistry.getById(modelId);
  if (!model) return false;

  const mimeToModality: Record<string, "image" | "audio" | "video" | "pdf"> = {
    "image/": "image",
    "audio/": "audio",
    "video/": "video",
    "application/pdf": "pdf",
  };

  for (const [prefix, modality] of Object.entries(mimeToModality)) {
    if (fileType.startsWith(prefix)) {
      return model.inputModalities.includes(modality);
    }
  }

  // Default to text
  return model.inputModalities.includes("text");
}

// =============================================================================
// MODEL GROUPING
// =============================================================================

/**
 * Agrupa modelos por proveedor
 */
export function groupByProvider(models: RegisteredModel[]): Record<Provider, RegisteredModel[]> {
  const groups: Record<string, RegisteredModel[]> = {};

  for (const model of models) {
    if (!groups[model.provider]) {
      groups[model.provider] = [];
    }
    groups[model.provider].push(model);
  }

  return groups as Record<Provider, RegisteredModel[]>;
}

/**
 * Agrupa modelos por capacidad principal
 */
export function groupByPrimaryCapability(
  models: RegisteredModel[]
): Record<ModelCapability, RegisteredModel[]> {
  const groups: Record<string, RegisteredModel[]> = {};

  for (const model of models) {
    if (!groups[model.primaryCapability]) {
      groups[model.primaryCapability] = [];
    }
    groups[model.primaryCapability].push(model);
  }

  return groups as Record<ModelCapability, RegisteredModel[]>;
}

/**
 * Agrupa modelos por tier de costo
 */
export function groupByCostTier(
  models: RegisteredModel[]
): Record<string, RegisteredModel[]> {
  const groups: Record<string, RegisteredModel[]> = {};

  for (const model of models) {
    if (!groups[model.costTier]) {
      groups[model.costTier] = [];
    }
    groups[model.costTier].push(model);
  }

  return groups;
}

// =============================================================================
// MODEL COMPARISON
// =============================================================================

/**
 * Compara dos modelos lado a lado
 */
export function compareModels(
  modelIdA: string,
  modelIdB: string
): {
  modelA: RegisteredModel | undefined;
  modelB: RegisteredModel | undefined;
  comparison: {
    fasterModel: string | null;
    cheaperModel: string | null;
    largerContext: string | null;
    moreCapabilities: string | null;
  };
} {
  const modelA = modelRegistry.getById(modelIdA);
  const modelB = modelRegistry.getById(modelIdB);

  const speedOrder = { instant: 0, fast: 1, medium: 2, slow: 3 };
  const costOrder = { free: 0, low: 1, medium: 2, high: 3, premium: 4 };

  return {
    modelA,
    modelB,
    comparison: {
      fasterModel:
        modelA && modelB
          ? speedOrder[modelA.speedTier] < speedOrder[modelB.speedTier]
            ? modelIdA
            : speedOrder[modelA.speedTier] > speedOrder[modelB.speedTier]
            ? modelIdB
            : null
          : null,
      cheaperModel:
        modelA && modelB
          ? costOrder[modelA.costTier] < costOrder[modelB.costTier]
            ? modelIdA
            : costOrder[modelA.costTier] > costOrder[modelB.costTier]
            ? modelIdB
            : null
          : null,
      largerContext:
        modelA && modelB
          ? modelA.contextWindow > modelB.contextWindow
            ? modelIdA
            : modelA.contextWindow < modelB.contextWindow
            ? modelIdB
            : null
          : null,
      moreCapabilities:
        modelA && modelB
          ? modelA.capabilities.length > modelB.capabilities.length
            ? modelIdA
            : modelA.capabilities.length < modelB.capabilities.length
            ? modelIdB
            : null
          : null,
    },
  };
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Valida que un modelo existe y está habilitado
 */
export function validateModel(modelId: string): {
  valid: boolean;
  model: RegisteredModel | undefined;
  error?: string;
} {
  const model = modelRegistry.getById(modelId);

  if (!model) {
    return {
      valid: false,
      model: undefined,
      error: `Model "${modelId}" not found`,
    };
  }

  if (!model.enabled) {
    return {
      valid: false,
      model,
      error: `Model "${modelId}" is not enabled`,
    };
  }

  return {
    valid: true,
    model,
  };
}

/**
 * Valida que un modelo soporta las capacidades requeridas
 */
export function validateModelCapabilities(
  modelId: string,
  requiredCapabilities: ModelCapability[]
): {
  valid: boolean;
  model: RegisteredModel | undefined;
  missingCapabilities: ModelCapability[];
} {
  const model = modelRegistry.getById(modelId);

  if (!model) {
    return {
      valid: false,
      model: undefined,
      missingCapabilities: requiredCapabilities,
    };
  }

  const missing = requiredCapabilities.filter(
    (cap) => !model.capabilities.includes(cap)
  );

  return {
    valid: missing.length === 0,
    model,
    missingCapabilities: missing,
  };
}

import { useMemo } from 'react';
import AI_MODELS from '@/shared/AiModelList';
import { ModelCapabilities } from '@/types/AiModel';

export function useCommonTools(selectedModelIds: string[]) {
  const commonCapabilities = useMemo(() => {
    if (selectedModelIds.length === 0) {
      return null;
    }

    // Get the actual model objects for the selected IDs
    const selectedModels = AI_MODELS.filter(model => 
      selectedModelIds.includes(model.model)
    );

    if (selectedModels.length === 0) return null;

    // Start with the capabilities of the first selected model (using its first submodel as reference)
    // We assume the first submodel represents the main capabilities for now
    const firstModel = selectedModels[0];
    const firstSubModel = firstModel.subModel[0];
    
    if (!firstSubModel) return null;

    const capabilities: ModelCapabilities = { ...firstSubModel.capabilities };

    // Intersect with all other selected models
    for (let i = 1; i < selectedModels.length; i++) {
      const model = selectedModels[i];
      const subModel = model.subModel[0]; // Again, using first submodel as reference
      
      if (!subModel) continue;

      capabilities.search = capabilities.search && subModel.capabilities.search;
      capabilities.code = capabilities.code && subModel.capabilities.code;
      capabilities.image = capabilities.image && subModel.capabilities.image;
      capabilities.video = capabilities.video && subModel.capabilities.video;
      
      capabilities.files.github = capabilities.files.github && subModel.capabilities.files.github;
      capabilities.files.figma = capabilities.files.figma && subModel.capabilities.files.figma;
      capabilities.files.local = capabilities.files.local && subModel.capabilities.files.local;
    }

    return capabilities;
  }, [selectedModelIds]);

  return commonCapabilities;
}

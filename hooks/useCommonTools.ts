import { useMemo } from 'react';
import AI_MODELS from '@/shared/AiModelList';
import { ModelCapabilities } from '@/types/AiModel';

export function useCommonTools(selectedModelIds: string[]) {
  const commonCapabilities = useMemo(() => {
    if (selectedModelIds.length === 0) {
      return null;
    }

    const selectedModels = AI_MODELS.filter(model => 
      selectedModelIds.includes(model.model)
    );

    if (selectedModels.length === 0) return null;

    const firstModel = selectedModels[0];
    const firstSubModel = firstModel.subModel[0];
    
    if (!firstSubModel) return null;

    const capabilities: ModelCapabilities = { ...firstSubModel.capabilities };

    for (let i = 1; i < selectedModels.length; i++) {
      const model = selectedModels[i];
      const subModel = model.subModel[0];
      
      if (!subModel) continue;

      capabilities.search = capabilities.search && subModel.capabilities.search;
      capabilities.deepthought = capabilities.deepthought && subModel.capabilities.deepthought;
      capabilities.image = capabilities.image && subModel.capabilities.image;
      capabilities.video = capabilities.video && subModel.capabilities.video;
    }

    return capabilities;
  }, [selectedModelIds]);

  return commonCapabilities;
}
import { useMemo } from 'react';
import AI_MODELS from '@/shared/AiModelList';
import { ModelCapabilities } from '@/types/AiModel';

interface SelectedSubModel {
  modelId: string;
  subModelId: string;
}

export function useCommonTools(selectedSubModels: SelectedSubModel[]) {
  const commonCapabilities = useMemo(() => {
    if (selectedSubModels.length === 0) {
      return null;
    }

    // Obtener las capabilities de cada submodelo seleccionado
    const subModelCapabilities = selectedSubModels
      .map(({ modelId, subModelId }) => {
        const model = AI_MODELS.find(m => m.model === modelId);
        if (!model) return null;

        const subModel = model.subModel.find(sm => sm.id === subModelId);
        if (!subModel) return null;

        return subModel.capabilities;
      })
      .filter(Boolean) as ModelCapabilities[];

    if (subModelCapabilities.length === 0) return null;

    // Empezar con las capabilities del primer submodelo
    const capabilities: ModelCapabilities = {
      search: subModelCapabilities[0].search,
      deepthought: subModelCapabilities[0].deepthought,
      image: subModelCapabilities[0].image,
      video: subModelCapabilities[0].video,
    };

    // Hacer AND de todas las capabilities (solo las que TODOS tienen)
    for (let i = 1; i < subModelCapabilities.length; i++) {
      const current = subModelCapabilities[i];
      
      capabilities.search = capabilities.search && current.search;
      capabilities.deepthought = capabilities.deepthought && current.deepthought;
      capabilities.image = capabilities.image && current.image;
      capabilities.video = capabilities.video && current.video;
    }

    return capabilities;
  }, [selectedSubModels]);

  return commonCapabilities;
}
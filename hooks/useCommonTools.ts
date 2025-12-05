import { useMemo } from 'react';
import AI_MODELS from '@/shared/AiModelList';
import { ModelCapabilities } from '@/types/AiModel';
import { SelectedModel } from '@/context/AIContext';

export function useCommonTools(selectedModelsInput: SelectedModel[]) {
  const commonCapabilities = useMemo(() => {
    if (selectedModelsInput.length === 0) {
      return null;
    }

    // Filter out any models that might not exist in our static list
    const validModels = selectedModelsInput
      .map((sm) => {
        const modelDef = AI_MODELS.find((m) => m.model === sm.modelId);
        if (!modelDef) return null;
        const subModelDef = modelDef.subModel.find((sub) => sub.id === sm.subModelId);
        return subModelDef ? { ...modelDef, selectedSubModel: subModelDef } : null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    if (validModels.length === 0) return null;

    const firstModel = validModels[0];
    const firstSubModel = firstModel.selectedSubModel;

    const capabilities: ModelCapabilities = { ...firstSubModel.capabilities };

    for (let i = 1; i < validModels.length; i++) {
      const model = validModels[i];
      const subModel = model.selectedSubModel;

      capabilities.search = capabilities.search && subModel.capabilities.search;
      capabilities.code = capabilities.code && subModel.capabilities.code;
      capabilities.image = capabilities.image && subModel.capabilities.image;
      capabilities.video = capabilities.video && subModel.capabilities.video;

      capabilities.files.github =
        capabilities.files.github && subModel.capabilities.files.github;
      capabilities.files.figma =
        capabilities.files.figma && subModel.capabilities.files.figma;
      capabilities.files.local =
        capabilities.files.local && subModel.capabilities.files.local;
    }

    return capabilities;
  }, [selectedModelsInput]);

  return commonCapabilities;
}
"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SPECIALIZED_MODELS } from '@/shared/AiModelList';
import { SelectedModel, SpecializedModel, Provider } from '@/types/AiModel';

interface AIContextType {
  selectedModels: SelectedModel[];
  toggleModel: (model: SpecializedModel) => void;
  removeModelInstance: (index: number) => void; 
  isModelSelected: (modelId: string) => boolean;
  getModelsByProvider: (provider: Provider) => SpecializedModel[];
  getSelectedModelsByProvider: (provider: Provider) => SelectedModel[];
  hasModelsSelected: boolean;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIContextProvider({ children }: { children: ReactNode }) {
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);

  const toggleModel = (model: SpecializedModel) => {
    setSelectedModels(prev => {
      // For reasoning models, always add (allow multiple instances)
      if (model.category === 'reasoning') {
        return [
          ...prev,
          {
            category: model.category,
            modelId: model.id,
            provider: model.provider,
            providerModelId: model.providerModelId,
          },
        ];
      }
      
      // For specialized models (image/video), normal toggle behavior
      const exists = prev.find(m => m.modelId === model.id);
      
      if (exists) {
        // Remove model (only the first instance)
        const index = prev.findIndex(m => m.modelId === model.id);
        return prev.filter((_, i) => i !== index);
      } else {
        // Add model
        return [
          ...prev,
          {
            category: model.category,
            modelId: model.id,
            provider: model.provider,
            providerModelId: model.providerModelId,
          },
        ];
      }
    });
  };

  // Remove a specific instance by index
  const removeModelInstance = (index: number) => {
    setSelectedModels(prev => prev.filter((_, i) => i !== index));
  };

  const isModelSelected = (modelId: string) => {
    return selectedModels.some(m => m.modelId === modelId);
  };

  const getModelsByProvider = (provider: Provider) => {
    return SPECIALIZED_MODELS.filter(m => m.provider === provider);
  };

  const getSelectedModelsByProvider = (provider: Provider) => {
    return selectedModels.filter(m => m.provider === provider);
  };

  const hasModelsSelected = selectedModels.length > 0;

  return (
    <AIContext.Provider
      value={{
        selectedModels,
        toggleModel,
        removeModelInstance,
        isModelSelected,
        getModelsByProvider,
        getSelectedModelsByProvider,
        hasModelsSelected,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAIContext must be used within an AIContextProvider');
  }
  return context;
}
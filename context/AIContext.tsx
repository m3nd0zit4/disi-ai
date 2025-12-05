"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import AI_MODELS from '@/shared/AiModelList';

export interface SelectedModel {
  modelId: string;
  subModelId: string;
}

interface AIContextType {
  selectedModels: SelectedModel[];
  toggleModel: (modelId: string) => void;
  changeSubModel: (modelId: string, subModelId: string) => void;
  isModelSelected: (modelId: string) => boolean;
  getModelInfo: (modelId: string) => typeof AI_MODELS[0] | undefined;
  hasModelsSelected: boolean;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIContextProvider({ children }: { children: ReactNode }) {
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);

  const getDefaultSubModel = (modelId: string) => {
    const model = AI_MODELS.find(m => m.model === modelId);
    return model?.subModel[0]?.id || '';
  };

  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => {
      const exists = prev.find(m => m.modelId === modelId);
      
      if (exists) {
        // Remover modelo
        return prev.filter(m => m.modelId !== modelId);
      } else {
        // Agregar modelo con sub-modelo por defecto
        return [
          ...prev,
          {
            modelId,
            subModelId: getDefaultSubModel(modelId),
          },
        ];
      }
    });
  };

  const changeSubModel = (modelId: string, subModelId: string) => {
    setSelectedModels(prev =>
      prev.map(m =>
        m.modelId === modelId ? { ...m, subModelId } : m
      )
    );
  };

  const isModelSelected = (modelId: string) => {
    return selectedModels.some(m => m.modelId === modelId);
  };

  const getModelInfo = (modelId: string) => {
    return AI_MODELS.find(m => m.model === modelId);
  };

  const hasModelsSelected = selectedModels.length > 0;

  return (
    <AIContext.Provider
      value={{
        selectedModels,
        toggleModel,
        changeSubModel,
        isModelSelected,
        getModelInfo,
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
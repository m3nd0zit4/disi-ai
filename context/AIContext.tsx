"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SPECIALIZED_MODELS } from '@/shared/AiModelList';
import { SelectedModel, SpecializedModel, Provider } from '@/types/AiModel';

interface AIContextType {
  selectedModels: SelectedModel[];
  toggleModel: (model: SpecializedModel) => void;
  removeModelInstance: (index: number) => void; 
  toggleModelEnabled: (index: number) => void;
  toggleSpecializedModel: (reasoningIndex: number, specializedModel: SpecializedModel) => void;
  isModelSelected: (modelId: string) => boolean;
  isSpecializedModelSelected: (reasoningIndex: number, modelId: string) => boolean;
  getModelsByProvider: (provider: Provider) => SpecializedModel[];
  getSelectedModelsByProvider: (provider: Provider) => SelectedModel[];
  moveModel: (fromIndex: number, toIndex: number) => void;
  reorderModels: (newModels: SelectedModel[]) => void;
  getAllSpecializedModels: () => SpecializedModel[];
  setModelsFromConversation: (models: SelectedModel[]) => void; // NEW: Restore models from conversation
  hasModelsSelected: boolean;
  
  // Tool Actions
  enabledTools: Record<string, boolean>;
  isToolEnabled: (toolId: string) => boolean;
  toggleToolEnabled: (toolId: string, value?: boolean) => void;
}


const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIContextProvider({ children }: { children: ReactNode }) {
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});


  const toggleModel = (model: SpecializedModel) => {
    setSelectedModels(prev => {
      const exists = prev.find(m => m.modelId === model.id);
      
      if (exists) {
        // Remove model (all instances of this modelId)
        return prev.filter(m => m.modelId !== model.id);
      } else {
        // Add model
        return [
          ...prev,
          {
            category: model.category,
            modelId: model.id,
            provider: model.provider,
            providerModelId: model.providerModelId,
            isEnabled: true,
            specializedModels: model.category === 'reasoning' ? [] : undefined,
          },
        ];
      }
    });
  };

  // Remove a specific instance by index
  const removeModelInstance = (index: number) => {
    setSelectedModels(prev => prev.filter((_, i) => i !== index));
  };

  // Toggle enabled state of a specific instance by index
  const toggleModelEnabled = (index: number) => {
    setSelectedModels(prev => 
      prev.map((model, i) => 
        i === index ? { ...model, isEnabled: !model.isEnabled } : model
      )
    );
  };

  // Toggle specialized model for a specific reasoning model instance
  const toggleSpecializedModel = (reasoningIndex: number, specializedModel: SpecializedModel) => {
    setSelectedModels(prev => 
      prev.map((model, i) => {
        if (i !== reasoningIndex) return model;
        
        const currentSpecialized = model.specializedModels || [];
        const exists = currentSpecialized.includes(specializedModel.id);
        
        return {
          ...model,
          specializedModels: exists
            ? currentSpecialized.filter(id => id !== specializedModel.id)
            : [...currentSpecialized, specializedModel.id]
        };
      })
    );
  };

  // Check if a specialized model is selected for a specific reasoning instance
  const isSpecializedModelSelected = (reasoningIndex: number, modelId: string): boolean => {
    const model = selectedModels[reasoningIndex];
    if (!model || !model.specializedModels) return false;
    return model.specializedModels.includes(modelId);
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

  const moveModel = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex < 0 || 
      fromIndex >= selectedModels.length ||
      toIndex < 0 || 
      toIndex >= selectedModels.length
    ) return;
    
    setSelectedModels(prev => {
      const newModels = [...prev];
      const [movedItem] = newModels.splice(fromIndex, 1);
      newModels.splice(toIndex, 0, movedItem);
      return newModels;
    });
  };

  const reorderModels = (newModels: SelectedModel[]) => {
    setSelectedModels(newModels);
  };

  const getAllSpecializedModels = () => {
    return SPECIALIZED_MODELS.filter(m => m.category === 'image' || m.category === 'video');
  };

  // NEW: Restore model configuration from a conversation
  const setModelsFromConversation = (models: SelectedModel[]) => {
    setSelectedModels(models.map(m => ({
      category: m.category,
      modelId: m.modelId,
      provider: m.provider,
      providerModelId: m.providerModelId,
      isEnabled: m.isEnabled ?? true,
      specializedModels: m.specializedModels || [],
    })));
  };

  const hasModelsSelected = selectedModels.length > 0;

  // Tool Actions Logic
  const isToolEnabled = (toolId: string) => !!enabledTools[toolId];

  const toggleToolEnabled = (toolId: string, value?: boolean) => {
    setEnabledTools(prev => ({
      ...prev,
      [toolId]: value !== undefined ? value : !prev[toolId]
    }));
  };


  return (
    <AIContext.Provider
      value={{
        selectedModels,
        toggleModel,
        removeModelInstance,
        toggleModelEnabled,
        toggleSpecializedModel,
        isModelSelected,
        isSpecializedModelSelected,
        getModelsByProvider,
        getSelectedModelsByProvider,
        moveModel,
        reorderModels,
        getAllSpecializedModels,
        setModelsFromConversation,
        hasModelsSelected,
        enabledTools,
        isToolEnabled,
        toggleToolEnabled,
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
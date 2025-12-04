"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import AI_MODELS from '@/shared/AiModelList';

interface AIContextType {
  selectedModels: string[];
  toggleModelSelection: (modelId: string) => void;
  setSelectedModels: (models: string[]) => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIContextProvider({ children }: { children: ReactNode }) {
  // Default to the first model selected
  const [selectedModels, setSelectedModels] = useState<string[]>(
    AI_MODELS[0]?.model ? [AI_MODELS[0].model] : []
  );

  const toggleModelSelection = (modelId: string) => {
    setSelectedModels((prev) => 
      prev.includes(modelId) 
        ? prev.filter((m) => m !== modelId) 
        : [...prev, modelId]
    );
  };

  return (
    <AIContext.Provider value={{ selectedModels, toggleModelSelection, setSelectedModels }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAIContext must be used within an AIContextProvider');
  }
  return context;
}

"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface AIFeaturesContextType {
  thinkingEnabled: boolean;
  /** Force RLM full (planner → workers → aggregator) regardless of context size */
  rlmForceFull: boolean;
  setThinkingEnabled: (enabled: boolean) => void;
  setRlmForceFull: (enabled: boolean) => void;
}

const AIFeaturesContext = createContext<AIFeaturesContextType | undefined>(undefined);

export function AIFeaturesProvider({ children }: { children: React.ReactNode }) {
  const defaults = useQuery(api.users.settings.getAiFeatureDefaults);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [rlmForceFull, setRlmForceFull] = useState(false);

  useEffect(() => {
    if (defaults == null) return;
    setThinkingEnabled(defaults.thinkingEnabled);
    setRlmForceFull(defaults.rlmForceFullByDefault);
  }, [defaults?.thinkingEnabled, defaults?.rlmForceFullByDefault]);

  return (
    <AIFeaturesContext.Provider
      value={{
        thinkingEnabled,
        rlmForceFull,
        setThinkingEnabled,
        setRlmForceFull,
      }}
    >
      {children}
    </AIFeaturesContext.Provider>
  );
}

export function useAIFeatures() {
  const context = useContext(AIFeaturesContext);
  if (!context) {
    throw new Error('useAIFeatures must be used within AIFeaturesProvider');
  }
  return context;
}

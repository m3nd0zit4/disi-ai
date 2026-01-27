/**
 * useModes Hook
 *
 * Hook de React para trabajar con modos de usuario.
 *
 * @example
 * ```tsx
 * function ModeSelector() {
 *   const { modes, selectedMode, selectMode, resolvedModel } = useModes();
 *
 *   return (
 *     <div>
 *       {modes.map(mode => (
 *         <button
 *           key={mode.id}
 *           onClick={() => selectMode(mode.id)}
 *           className={selectedMode === mode.id ? "active" : ""}
 *         >
 *           {mode.displayName}
 *         </button>
 *       ))}
 *       <p>Using model: {resolvedModel?.displayName}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @date 2026-01-25
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import {
  UserMode,
  ModeConfig,
  ModeSelection,
  ModeSettings,
  getEnabledModes,
  getRecommendedMode,
  getFreeModes,
  getModeConfig,
  resolveMode,
  suggestModeForTask,
} from "../modes";
import { modelRegistry, RegisteredModel } from "../registry";

export interface UseModesOptions {
  /** Initial mode (defaults to recommended) */
  initialMode?: UserMode;

  /** Whether user has premium */
  hasPremium?: boolean;

  /** Override settings */
  settingsOverride?: Partial<ModeSettings>;
}

export interface UseModesReturn {
  /** All available modes */
  modes: ModeConfig[];

  /** Free modes only */
  freeModes: ModeConfig[];

  /** Currently selected mode */
  selectedMode: UserMode;

  /** Current mode configuration */
  modeConfig: ModeConfig;

  /** Resolved model selection */
  selection: ModeSelection;

  /** Resolved model object */
  resolvedModel: RegisteredModel | undefined;

  /** Select a mode */
  selectMode: (mode: UserMode) => void;

  /** Get mode config by ID */
  getModeConfig: (mode: UserMode) => ModeConfig;

  /** Suggest mode for a task */
  suggestMode: (task: string) => UserMode;

  /** Check if a mode requires premium */
  modeRequiresPremium: (mode: UserMode) => boolean;

  /** Update settings override */
  setSettingsOverride: (settings: Partial<ModeSettings>) => void;

  /** Current settings */
  settings: ModeSettings;
}

/**
 * Hook para trabajar con modos de usuario
 */
export function useModes(options: UseModesOptions = {}): UseModesReturn {
  const {
    initialMode,
    hasPremium = false,
    settingsOverride: initialSettingsOverride,
  } = options;

  // Get recommended mode for initial state
  const recommendedMode = useMemo(() => getRecommendedMode(), []);

  // State
  const [selectedMode, setSelectedMode] = useState<UserMode>(
    initialMode || recommendedMode.id
  );
  const [settingsOverride, setSettingsOverride] = useState<Partial<ModeSettings>>(
    initialSettingsOverride || {}
  );

  // Memoized data
  const modes = useMemo(() => getEnabledModes(), []);
  const freeModes = useMemo(() => getFreeModes(), []);

  const modeConfig = useMemo(
    () => getModeConfig(selectedMode),
    [selectedMode]
  );

  const selection = useMemo(
    () =>
      resolveMode(selectedMode, {
        hasPremium,
        settingsOverride,
      }),
    [selectedMode, hasPremium, settingsOverride]
  );

  const resolvedModel = useMemo(
    () => modelRegistry.getById(selection.modelId),
    [selection.modelId]
  );

  // Callbacks
  const selectMode = useCallback((mode: UserMode) => {
    setSelectedMode(mode);
  }, []);

  const getModeConfigCallback = useCallback(
    (mode: UserMode) => getModeConfig(mode),
    []
  );

  const suggestMode = useCallback(
    (task: string) => suggestModeForTask(task),
    []
  );

  const modeRequiresPremium = useCallback(
    (mode: UserMode) => getModeConfig(mode).requiresPremium,
    []
  );

  return {
    modes,
    freeModes,
    selectedMode,
    modeConfig,
    selection,
    resolvedModel,
    selectMode,
    getModeConfig: getModeConfigCallback,
    suggestMode,
    modeRequiresPremium,
    setSettingsOverride,
    settings: selection.settings,
  };
}

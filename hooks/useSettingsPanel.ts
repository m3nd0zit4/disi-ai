import { create } from "zustand";

interface SettingsPanelStore {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  setOpen: (open: boolean) => void;
}

export const useSettingsPanel = create<SettingsPanelStore>((set) => ({
  open: false,
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false }),
  setOpen: (open) => set({ open }),
}));

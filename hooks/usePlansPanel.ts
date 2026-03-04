import { create } from "zustand";

interface PlansPanelStore {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  setOpen: (open: boolean) => void;
}

export const usePlansPanel = create<PlansPanelStore>((set) => ({
  open: false,
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false }),
  setOpen: (open) => set({ open }),
}));

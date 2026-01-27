import { create } from "zustand";

interface KnowledgeCommandStore {
  isOpen: boolean;
  selectedKbId: string | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setSelectedKbId: (id: string | null) => void;
}

export const useKnowledgeCommand = create<KnowledgeCommandStore>((set) => ({
  isOpen: false,
  selectedKbId: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setSelectedKbId: (id) => set({ selectedKbId: id }),
}));

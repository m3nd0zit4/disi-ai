"use client";

import { create } from "zustand";
import { DialogType } from "@/app/_components/ui/Dialog";

interface DialogState {
  isOpen: boolean;
  title: string;
  description: string;
  type: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onClose?: () => void;
  
  // Actions
  showDialog: (options: {
    title: string;
    description: string;
    type?: DialogType;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onClose?: () => void;
  }) => void;
  hideDialog: () => void;
}

export const useDialog = create<DialogState>((set) => ({
  isOpen: false,
  title: "",
  description: "",
  type: "info",
  confirmText: "Confirm",
  cancelText: "Cancel",
  onConfirm: undefined,
  onClose: undefined,

  showDialog: (options) =>
    set({
      isOpen: true,
      title: options.title,
      description: options.description,
      type: options.type || "info",
      confirmText: options.confirmText || "Confirm",
      cancelText: options.cancelText || "Cancel",
      onConfirm: options.onConfirm,
      onClose: options.onClose,
    }),

  hideDialog: () =>
    set({
      isOpen: false,
    }),
}));

"use client";

import React from "react";
import { Dialog } from "./Dialog";
import { useDialog } from "@/hooks/useDialog";

export function GlobalDialog() {
  const { isOpen, title, description, type, confirmText, cancelText, onConfirm, onClose, hideDialog } = useDialog();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        hideDialog();
        onClose?.();
      }}
      onConfirm={onConfirm}
      title={title}
      description={description}
      type={type}
      confirmText={confirmText}
      cancelText={cancelText}
    />
  );
}

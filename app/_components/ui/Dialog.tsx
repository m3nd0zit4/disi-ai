"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type DialogType = "info" | "success" | "warning" | "error" | "confirm";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
}

export function Dialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  type = "info",
  confirmText = "Confirm",
  cancelText = "Cancel",
}: DialogProps) {
  const icons = {
    info: <HelpCircle className="w-6 h-6 text-blue-500" />,
    success: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
    warning: <AlertCircle className="w-6 h-6 text-amber-500" />,
    error: <AlertCircle className="w-6 h-6 text-red-500" />,
    confirm: <HelpCircle className="w-6 h-6 text-primary" />,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-background/40 backdrop-blur-sm"
          />

          {/* Dialog Content */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
              className="w-full max-w-[340px] pointer-events-auto overflow-hidden rounded-2xl border border-primary/10 bg-card/90 backdrop-blur-2xl shadow-2xl"
            >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-primary/5 shrink-0">
                    {React.cloneElement(icons[type] as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h3 className="text-[15px] font-bold tracking-tight text-foreground mb-0.5">
                      {title}
                    </h3>
                    <p className="text-[13px] text-muted-foreground leading-snug">
                      {description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                  {type === "confirm" ? (
                    <>
                      <Button
                        variant="ghost"
                        onClick={onClose}
                        className="rounded-lg px-4 h-8 text-[12px] font-bold"
                      >
                        {cancelText}
                      </Button>
                      <Button
                        onClick={() => {
                          onConfirm?.();
                          onClose();
                        }}
                        className="rounded-lg px-4 h-8 text-[12px] font-bold bg-primary shadow-lg shadow-primary/20"
                      >
                        {confirmText}
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={onClose}
                      className="rounded-lg px-6 h-8 text-[12px] font-bold bg-primary shadow-lg shadow-primary/20"
                    >
                      OK
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

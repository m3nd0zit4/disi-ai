"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmToolBarProps {
  tool: string;
  args?: Record<string, unknown>;
  callId?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

const FRIENDLY_TOOL_NAMES: Record<string, string> = {
  delete_file: "Eliminar archivo",
  deploy: "Desplegar",
  request_confirmation: "Confirmar acción",
};

function friendlyName(name: string): string {
  const normalized = name.replace(/-/g, "_");
  return FRIENDLY_TOOL_NAMES[normalized] ?? name.replace(/_/g, " ");
}

export function ConfirmToolBar({
  tool,
  args,
  onConfirm,
  onCancel,
  disabled,
  className,
}: ConfirmToolBarProps) {
  const [loading, setLoading] = useState<"confirm" | "cancel" | null>(null);
  const isDisabled = disabled || loading !== null;

  const handleConfirm = async () => {
    setLoading("confirm");
    try {
      await onConfirm();
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    setLoading("cancel");
    try {
      await onCancel();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3",
        className
      )}
    >
      <span className="text-sm font-medium text-foreground/90">
        ¿Ejecutar &quot;{friendlyName(tool)}&quot;?
      </span>
      {args && Object.keys(args).length > 0 && (
        <span className="text-xs text-muted-foreground">
          {JSON.stringify(args)}
        </span>
      )}
      <div className="flex gap-2 ml-auto">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/20"
          onClick={handleCancel}
          disabled={isDisabled}
        >
          {loading === "cancel" ? (
            <span className="animate-pulse">…</span>
          ) : (
            <>
              <X className="h-3.5 w-3.5" />
              Cancelar
            </>
          )}
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handleConfirm}
          disabled={isDisabled}
        >
          {loading === "confirm" ? (
            <span className="animate-pulse">…</span>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              Confirmar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

"use client";

/**
 * Tool UI surface: renders tool results using Tool UI components only.
 * No PromptKit-style UI (no Input/Output sections, no state badges, no custom actions).
 * @see https://www.tool-ui.com/docs/actions
 * @see https://www.tool-ui.com/docs/overview
 */

import { cn } from "@/lib/utils";
import { Loader2, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { TypewriterText } from "@/components/ui/typewriter-text";
import { renderToolOutput, getToolLabel } from "@/app/_components/canvas/tool-renderers/toolkit";

const PROCESSING_PHRASES = [
  "Consultando la web...",
  "Leyendo resultados...",
  "Conectando fuentes...",
  "Casi listo...",
];

export type ToolPart = {
  type: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  toolCallId?: string;
  errorText?: string;
};

export type ToolProps = {
  toolPart: ToolPart;
  defaultOpen?: boolean;
  className?: string;
  processingContent?: React.ReactNode;
};

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * Tool UI surface only. Renders the toolkit result (Citation, LinkPreview, TimeDisplay, etc.)
 * with an optional minimal label. No PromptKit collapsible/Input/Output/actions.
 */
const Tool = ({ toolPart, className, processingContent }: ToolProps) => {
  const { state, output } = toolPart;
  const [phraseIndex, setPhraseIndex] = useState(0);
  const isStreaming = state === "input-streaming";

  useEffect(() => {
    if (!isStreaming) return;
    const t = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PROCESSING_PHRASES.length);
    }, 2800);
    return () => clearInterval(t);
  }, [isStreaming]);

  const toolkitContent = output ? renderToolOutput(toolPart) : null;

  return (
    <div
      className={cn("min-w-0 rounded-lg", className)}
      data-slot="tool-ui"
    >
      <div className="flex items-center gap-2 pb-1.5">
        <span className="text-muted-foreground text-xs font-medium">
          {getToolLabel(toolPart.type)}
        </span>
      </div>

      {state === "input-streaming" && (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          {processingContent ?? (
            <TypewriterText
              text={PROCESSING_PHRASES[phraseIndex]}
              enabled={true}
              charMs={36}
              suffix={<span className="inline-block w-1.5 h-3.5 ml-0.5 bg-primary/50 animate-pulse align-middle rounded-sm" />}
            />
          )}
        </div>
      )}

      {state === "output-available" && output && (
        <div data-slot="tool-ui-surface">
          {toolkitContent ?? (
            <div className="bg-muted/20 max-h-60 overflow-auto rounded-md border p-2 font-mono text-sm">
              <pre className="whitespace-pre-wrap">{formatValue(output)}</pre>
            </div>
          )}
        </div>
      )}

      {state === "output-error" && toolPart.errorText && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-500/5 p-2 text-sm text-red-600 dark:border-red-950 dark:bg-red-900/20 dark:text-red-400">
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{toolPart.errorText}</span>
        </div>
      )}

      {state === "input-available" && !output && (
        <div className="text-muted-foreground py-2 text-xs">Listo</div>
      )}
    </div>
  );
};

export { Tool };

"use client";

import { Wrench, ChevronDown, ChevronRight, Loader2, Check, AlertCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ToolCallItem {
  tool: string;
  status: "processing" | "completed" | "error";
  resultsCount?: number;
  error?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  callId?: string;
  steps?: string[];
}

export interface AgentToolLoopBlockProps {
  /** All tool calls in order (each iteration of the agent loop) */
  toolCallsHistory: ToolCallItem[];
  /** Current tool still running (optional; shown as last row if status is searching) */
  currentTool?: { tool: string; status: "processing"; input?: Record<string, unknown>; steps?: string[] };
  /** Optional list of tool names available for the current model (built-in + custom); shown as "Herramientas disponibles: …" */
  availableToolNames?: string[];
  className?: string;
  defaultOpen?: boolean;
}

const FRIENDLY_TOOL_NAMES: Record<string, string> = {
  web_search: "Búsqueda web",
  get_current_time: "Hora actual",
  calculator: "Calculadora",
  text_stats: "Estadísticas de texto",
  google_search: "Búsqueda Google",
  x_search: "Búsqueda en X",
  code_execution: "Ejecución de código",
  code_interpreter: "Intérprete de código",
  file_search: "Búsqueda en archivos",
  image_generation: "Generación de imágenes",
  computer_use: "Uso de ordenador",
  collections_search: "Búsqueda en colecciones",
  web_search_preview: "Búsqueda web (vista previa)",
  url_context: "Contexto por URL",
  google_maps: "Google Maps",
  enterprise_web_search: "Búsqueda web empresarial",
};

function friendlyToolName(name: string): string {
  const normalized = name.replace(/-/g, "_");
  if (FRIENDLY_TOOL_NAMES[normalized]) return FRIENDLY_TOOL_NAMES[normalized];
  if (FRIENDLY_TOOL_NAMES[name]) return FRIENDLY_TOOL_NAMES[name];
  return name.replace(/_/g, " ");
}

function formatOutput(output: unknown): string {
  if (output == null) return "";
  if (Array.isArray(output)) return `${output.length} resultado(s)`;
  const o = output as Record<string, unknown>;
  if (typeof o === "object" && "time" in o) return String(o.time ?? "");
  if (typeof o === "object" && "result" in o && typeof o.result === "number") return `= ${o.result}`;
  if (typeof o === "object" && "wordCount" in o) return `${o.wordCount} palabras, ${o.length} caracteres`;
  if (typeof output === "string") return output.slice(0, 80) + (output.length > 80 ? "…" : "");
  return "";
}

function formatInput(input?: Record<string, unknown>): string {
  if (!input || typeof input !== "object") return "";
  const parts = Object.entries(input)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.length ? parts.slice(0, 4).join(", ") : "";
}

export function AgentToolLoopBlock({
  toolCallsHistory,
  currentTool,
  availableToolNames,
  className,
  defaultOpen = false,
}: AgentToolLoopBlockProps) {
  const [open, setOpen] = useState(defaultOpen);
  const items = currentTool
    ? [...toolCallsHistory, { ...currentTool, status: "processing" as const }]
    : toolCallsHistory;

  if (items.length === 0 && !availableToolNames?.length) return null;

  const processingCount = items.filter((i) => i.status === "processing").length;

  return (
    <div className={cn("min-w-0 transition-opacity duration-300", className)}>
      {availableToolNames && availableToolNames.length > 0 && (
        <p className="text-[11px] text-muted-foreground/60 mb-0.5">
          {availableToolNames.map(friendlyToolName).join(" · ")}
        </p>
      )}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left rounded px-0.5 py-0.5 -mx-0.5 hover:bg-muted/30 transition-colors">
          <span className="text-muted-foreground/70">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
          <Wrench className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
          <span className="text-xs text-muted-foreground">
            {items.length === 1 ? "1 herramienta" : `${items.length} herramientas`}
            {processingCount > 0 && " · …"}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-1 space-y-0.5 pl-4 border-l border-muted/30 ml-0.5">
            {items.map((call, idx) => {
              const isProcessing = call.status === "processing";
              const isError = call.status === "error";
              const isCompleted = call.status === "completed";
              const outputStr = call.output != null ? formatOutput(call.output) : "";
              const inputStr = formatInput(call.input);

              return (
                <li key={call.callId ?? `tool-${idx}`} className="flex items-center gap-1.5 py-0.5 min-w-0">
                  {isProcessing ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                  ) : isError ? (
                    <AlertCircle className="h-3 w-3 text-destructive/70 shrink-0" />
                  ) : (
                    <Check className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs text-foreground/85 truncate">
                    {friendlyToolName(call.tool)}
                  </span>
                  {outputStr && isCompleted && (
                    <span className="text-[11px] text-muted-foreground/70 truncate shrink-0" title={outputStr}>
                      {outputStr}
                    </span>
                  )}
                  {inputStr && (
                    <span className="text-[11px] text-muted-foreground/60 truncate max-w-[8rem]" title={inputStr}>
                      {inputStr}
                    </span>
                  )}
                  {isProcessing && call.steps?.length && (
                    <span className="text-[11px] text-muted-foreground/60 truncate max-w-[10rem]" title={call.steps[call.steps.length - 1]}>
                      {call.steps[call.steps.length - 1]}
                    </span>
                  )}
                  {isError && call.error && (
                    <span className="text-[11px] text-destructive/70 truncate max-w-[8rem]" title={call.error}>
                      {call.error}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

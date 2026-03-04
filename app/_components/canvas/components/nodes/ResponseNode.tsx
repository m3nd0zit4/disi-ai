import { memo, useMemo, useState, useCallback, useEffect } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { Sparkles, Lock, ChevronDown, ChevronUp, Leaf, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import Image from "next/image";
import { modelRegistry } from "@/shared/ai";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { NodeHandle } from "./NodeHandle";
import { AlertCircle, Settings, Check } from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { evaluateForKnowledge } from "@/lib/knowledge/evaluator";
import { usePathname } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { ThinkingBar } from "@/components/ui/thinking-bar";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ui/reasoning";

import { ResponseNodeData } from "../../types";
import { CitationDisplay } from "../../CitationDisplay";
import { useConnections } from "../../providers/ConnectionsProvider";
import { Tool, type ToolPart } from "@/components/ui/tool";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getToolLabel } from "@/app/_components/canvas/tool-renderers/toolkit";
import { GripHorizontalAnimated } from "@/components/ui/grip-horizontal-animated";

function ToolsSectionCollapsible({
  defaultOpen,
  toolCount,
  status,
  toolCallsHistory,
  toolParts,
}: {
  defaultOpen: boolean;
  toolCount: number;
  status: string;
  toolCallsHistory?: Array<{ status?: string }>;
  toolParts: ToolPart[];
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Keep section open when parent says defaultOpen (e.g. when tools are present and we want bar always open)
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  return (
    <div className="min-w-0 space-y-1">
      <Collapsible open={open} onOpenChange={setOpen} className="min-w-0">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 rounded-md px-0 py-1.5 text-xs font-normal text-muted-foreground hover:text-foreground/80"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
            <span>Herramientas {toolCount > 0 ? `(${toolCount})` : ""}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-1">
          <div className="space-y-2">
            {toolParts.map((part, idx) => (
              <Tool
                key={`${part.toolCallId ?? idx}-${part.type}`}
                toolPart={part}
                defaultOpen={part.state === "output-available"}
                className="mt-1"
              />
            ))}
            {status === "thinking" && (toolCallsHistory?.length ?? 0) > 0 && (
              <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span>Pensando...</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

const GRADIENT_MAP: Record<string, string> = {
  "rgba(59, 130, 246, 0.15)": "bg-gradient-to-t from-[#E2ECFE] dark:from-[#111B2E] to-transparent",
  "rgba(168, 85, 247, 0.15)": "bg-gradient-to-t from-[#F2E6FE] dark:from-[#21142E] to-transparent",
  "rgba(236, 72, 153, 0.15)": "bg-gradient-to-t from-[#FCE4F0] dark:from-[#2B1220] to-transparent",
  "rgba(234, 179, 8, 0.15)":  "bg-gradient-to-t from-[#FCF4DA] dark:from-[#2B230B] to-transparent",
};

/** Map toolCallsHistory entry or current-tool data to ToolPart (Tool UI, AI SDK–aligned states). */
function entryToToolPart(
  entry: {
    tool: string;
    status: "processing" | "completed" | "error";
    input?: Record<string, unknown>;
    output?: unknown;
    callId?: string;
    error?: string;
    uiType?: string;
    uiProps?: Record<string, unknown>;
  },
  /** When node is complete, treat "processing" entries as completed so UI doesn't show loading. */
  nodeStatus?: string
): ToolPart {
  const resolvedStatus =
    nodeStatus === "complete" && entry.status === "processing" ? "completed" : entry.status;
  const state =
    resolvedStatus === "processing"
      ? "input-streaming"
      : resolvedStatus === "completed"
        ? "output-available"
        : "output-error";

  /** Unwrap output if SDK or backend wrapped it (e.g. { result: X } or { value: X }). */
  const rawOutput = entry.output;
  const unwrapped =
    rawOutput != null &&
    typeof rawOutput === "object" &&
    !Array.isArray(rawOutput) &&
    (rawOutput as Record<string, unknown>).result !== undefined
      ? (rawOutput as Record<string, unknown>).result
      : rawOutput != null &&
          typeof rawOutput === "object" &&
          !Array.isArray(rawOutput) &&
          Object.keys(rawOutput as Record<string, unknown>).length === 1 &&
          (rawOutput as Record<string, unknown>).value !== undefined
        ? (rawOutput as Record<string, unknown>).value
        : rawOutput;

  let output: Record<string, unknown> | undefined;
  if (unwrapped != null) {
    if (entry.uiType === "search_results" || entry.tool === "web_search") {
      const raw = entry.uiProps?.results ?? unwrapped;
      const results = Array.isArray(raw) ? raw : (raw as { sources?: unknown[] })?.sources;
      output = { results: Array.isArray(results) ? results : [] };
    } else if (entry.uiType === "time_display" || entry.tool === "get_current_time") {
      const o = unwrapped as { time?: string; date?: string; dayOfWeek?: string; timezone?: string } | string;
      if (typeof o === "string") {
        output = { time: o };
      } else {
        output = { time: o?.time, date: o?.date, dayOfWeek: o?.dayOfWeek, timezone: o?.timezone };
      }
    } else if (
      (entry.tool === "geo_map" ||
        entry.tool === "geo-map" ||
        entry.tool === "get_weather" ||
        entry.tool === "chart" ||
        entry.tool === "data_table" ||
        entry.tool === "data-table") &&
      typeof unwrapped === "object" &&
      unwrapped !== null &&
      !Array.isArray(unwrapped)
    ) {
      output = unwrapped as Record<string, unknown>;
    } else {
      output =
        typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped)
          ? (unwrapped as Record<string, unknown>)
          : { value: unwrapped };
    }
  } else if (entry.uiType === "search_results" && entry.uiProps?.results) {
    output = { results: entry.uiProps.results as unknown[] };
  } else if ((entry.uiType === "time_display" || entry.tool === "get_current_time") && entry.uiProps) {
    output = {
      time: entry.uiProps.time as string | undefined,
      date: entry.uiProps.date as string | undefined,
      dayOfWeek: entry.uiProps.dayOfWeek as string | undefined,
      timezone: entry.uiProps.timezone as string | undefined,
    };
  }

  return {
    type: entry.tool || "tool",
    state,
    input: entry.input,
    output,
    toolCallId: entry.callId,
    errorText: entry.error,
  };
}

export const ResponseNode = memo(({ id, data, selected }: NodeProps) => {
  const responseData = data as unknown as ResponseNodeData;
  const {
    text,
    modelId,
    createdAt,
    reasoning,
    structuredReasoning,
    content,
    thinkingContent,
    isProModel,
    isUserFree,
    status,
    color,
    error,
    errorType,
    role,
    importance,
    citations,
    toolStatus,
    toolName,
    toolResultsCount,
    toolInput,
    toolOutput,
    toolCallId,
    toolSteps,
    toolUiType,
    toolUiProps,
    toolCallsHistory,
    contentCollapsed,
    agentState,
    pendingToolCall,
    executionId,
  } = responseData;

  const { updateNode } = useConnections();
  const isExpanded = contentCollapsed !== true;
  const [isAddingToKG, setIsAddingToKG] = useState(false);
  const [addedToKG, setAddedToKG] = useState(false);
  const pathname = usePathname();
  const theme = useTheme().theme;

  // Extract canvasId from URL path (e.g., /canvas/abc123)
  const canvasIdFromPath = pathname?.split("/canvas/")?.[1]?.split("/")?.[0];
  const isLocked = isProModel && isUserFree;
  const { toast } = useToast();

  // Convex mutations for KG
  const createCandidate = useMutation(api.knowledge_garden.seedCandidates.createCandidate);
  const gardenSettings = useQuery(api.users.settings.getGardenSettings);

  // Normalize data: content = final answer (markdown), reasoning = thinking/reasoning (separate, markdown)
  const displayMarkdown = content?.markdown || text || "";
  const displayReasoning = structuredReasoning?.text || reasoning || thinkingContent || "";

  // Merge citations from RLM and web search tool for inline + block display
  const mergedCitations = useMemo(() => {
    const fromRlm = (citations || []).map((c) => ({
      url: c.url,
      title: c.title,
      description: c.description,
      domain: c.domain,
      favicon: c.favicon,
    }));
    const toolResults = Array.isArray(toolOutput) ? toolOutput : [];
    const fromTool = toolResults.map((r) => ({
      url: r.url,
      title: r.title,
      description: r.snippet,
      domain: r.domain,
      favicon: r.favicon,
    }));
    // Dedupe by url
    const seen = new Set<string>();
    return [...fromRlm, ...fromTool].filter((c) => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });
  }, [citations, toolOutput]);

  // Handle adding to Knowledge Garden
  const handleAddToKG = useCallback(async () => {
    if (!displayMarkdown || displayMarkdown.length < 50 || isAddingToKG || addedToKG) return;

    setIsAddingToKG(true);
    try {
      // Evaluate content
      const evaluation = evaluateForKnowledge(displayMarkdown);

      // Create candidate
      await createCandidate({
        canvasId: canvasIdFromPath ? canvasIdFromPath as Id<"canvas"> : undefined,
        nodeId: id,
        title: evaluation.suggestedTitle,
        content: displayMarkdown,
        summary: displayMarkdown.slice(0, 300) + (displayMarkdown.length > 300 ? "..." : ""),
        evaluationScore: evaluation.score,
        evaluationReasons: evaluation.reasons,
        evaluationMetrics: {
          wordCount: evaluation.metrics.wordCount,
          sentenceCount: evaluation.metrics.sentenceCount,
          hasStructure: evaluation.metrics.hasStructure,
          hasCodeBlocks: evaluation.metrics.hasCodeBlocks,
          informationDensity: evaluation.metrics.informationDensity,
        },
        status: "pending",
        feedMode: "manual",
        kbId: gardenSettings?.defaultKbId,
      });

      setAddedToKG(true);
      toast({
        title: "Added to Knowledge Garden",
        description: "Content saved as a seed candidate for review.",
      });
    } catch (error) {
      console.error("[ResponseNode] Failed to add to KG:", error);
      toast({
        title: "Failed to add",
        description: error instanceof Error ? error.message : "Could not add to Knowledge Garden",
        variant: "destructive",
      });
    } finally {
      setIsAddingToKG(false);
    }
  }, [displayMarkdown, isAddingToKG, addedToKG, createCandidate, canvasIdFromPath, id, gardenSettings, toast]);

  const modelInfo = modelRegistry.getById(modelId || "");
  const modelIcon = modelInfo?.icon;

  // Compute tool parts once for both the collapsible and the "main content" tool UIs when complete
  const toolsState = useMemo(() => {
    const hasAnyTools =
      (toolCallsHistory?.length ?? 0) > 0 ||
      (status === "searching" && toolName && (toolStatus === "processing" || toolStatus === "completed"));
    if (!hasAnyTools)
      return { toolParts: [] as ToolPart[], hasAnyTools: false, defaultToolsOpen: false, toolCount: 0 };
    const hasCurrentTool =
      status === "searching" &&
      toolName &&
      (toolStatus === "processing" || toolStatus === "completed") &&
      (toolCallsHistory?.length === 0 || toolCallsHistory?.[toolCallsHistory.length - 1]?.status !== "processing");
    const SEARCH_TYPES = new Set(["web_search", "google_search", "enterprise_web_search", "search_results"]);
    const rawParts: ToolPart[] = (toolCallsHistory ?? []).map((entry) =>
      entryToToolPart(
        {
          tool: entry.tool,
          status: entry.status,
          input: entry.input,
          output: entry.output,
          callId: entry.callId,
          error: entry.error,
          uiType: entry.uiType,
          uiProps: entry.uiProps,
        },
        status
      )
    );
    const lastIndexByCallId = new Map<string, number>();
    rawParts.forEach((part, idx) => {
      const id = part.toolCallId ?? `no-id-${idx}`;
      lastIndexByCallId.set(id, idx);
    });
    const dedupedIndices = Array.from(lastIndexByCallId.values()).sort((a, b) => a - b);
    const toolParts: ToolPart[] = dedupedIndices
      .map((i) => rawParts[i])
      .filter((part) => {
        if (part.type === "tool" || part.type === "Enlace") return false;
        if (SEARCH_TYPES.has(part.type)) {
          const results = part.output?.results ?? part.output?.sources;
          if (results == null || (Array.isArray(results) && results.length === 0)) return false;
        }
        return true;
      });
    if (hasCurrentTool) {
      toolParts.push(
        entryToToolPart(
          {
            tool: toolName ?? "tool",
            status: toolStatus === "error" ? "error" : (toolStatus ?? "processing") as "processing" | "completed" | "error",
            input: toolInput,
            output: toolOutput,
            callId: toolCallId,
            error: undefined,
            uiType: toolUiType,
            uiProps: toolUiProps,
          },
          status
        )
      );
    }
    const toolCount = toolParts.length;
    // Tools section always open by default when there are tools; user can collapse it if they want
    const defaultToolsOpen = true;
    return { toolParts, hasAnyTools, defaultToolsOpen, toolCount };
  }, [
    toolCallsHistory,
    status,
    toolName,
    toolStatus,
    toolInput,
    toolOutput,
    toolCallId,
    toolUiType,
    toolUiProps,
  ]);

  return (
    <div className="group relative select-none">
      <div 
        className={cn(
          "w-[350px] backdrop-blur-2xl transition-all duration-500 rounded-[2rem] overflow-hidden border border-primary/5",
          (!color || color === 'transparent') && "bg-white/80 dark:bg-white/[0.08]",
          selected ? "ring-1 ring-primary/30 shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-50" : "shadow-sm hover:border-primary/10"
        )}
        style={{ 
          backgroundColor: color && color !== 'transparent' ? color : undefined,
          borderColor: color && color !== 'transparent' ? color.replace('0.15', '0.3') : undefined
        }}
      >
        <NodeHandle type="target" position={Position.Top} className="group-hover:!opacity-100" />
        
        <div className="p-6 space-y-4">
          {isLocked ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-4">
              <div className="size-12 rounded-[1.25rem] bg-primary/10 flex items-center justify-center text-primary/70">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[14px] font-bold text-foreground/90">Unlock Advanced Models</h3>
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                  Requires a <span className="text-primary font-bold">Professional plan</span>.
                </p>
              </div>
              <Button className="w-full bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-bold h-9 rounded-xl border border-primary/10 transition-all">
                Subscribe Now
              </Button>
            </div>
          ) : (
            <>
              {/* 1) Thinking bar only when no tool activity yet — so it doesn't sit above searches */}
              {status === "thinking" && !displayReasoning && !(toolCallsHistory?.length ?? 0) && (
                <ThinkingBar
                  text={`${modelInfo?.displayName || modelId || "AI"} is thinking...`}
                />
              )}
              {/* 2) Reasoning content (streaming) */}
              {displayReasoning ? (
                <Reasoning isStreaming={status === "thinking"}>
                  <ReasoningTrigger>Show reasoning</ReasoningTrigger>
                  <ReasoningContent
                    className="ml-2 border-l-2 border-l-slate-200 px-2 pb-1 dark:border-l-slate-700"
                    markdown
                  >
                    {displayReasoning}
                  </ReasoningContent>
                </Reasoning>
              ) : null}
              {/* Tool UI: tool call list (collapsible); open while running, closes when complete. */}
              {toolsState.hasAnyTools ? (
                <ToolsSectionCollapsible
                  defaultOpen={toolsState.defaultToolsOpen}
                  toolCount={toolsState.toolCount}
                  status={status}
                  toolCallsHistory={toolCallsHistory}
                  toolParts={toolsState.toolParts}
                />
              ) : null}

              {/* Main Content */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-[14px] leading-relaxed text-foreground/90 font-medium selection:bg-primary/20">
                {/* Visible "generating" state: show whenever we're streaming or searching (with or without content yet) */}
                {(status === "streaming" || status === "searching") && !displayReasoning && (
                  <div className="flex items-center gap-2 mb-2 w-fit">
                    <GripHorizontalAnimated size={18} className="shrink-0" />
                    {status === "searching" && (
                      <span className="text-xs font-medium text-primary/80">
                        {toolName ? `Ejecutando: ${getToolLabel(toolName)}` : "Buscando información..."}
                      </span>
                    )}
                    <span className="sr-only">
                      {status === "searching"
                        ? (toolName ? `Ejecutando: ${getToolLabel(toolName)}` : "Buscando información...")
                        : "Generando respuesta..."}
                    </span>
                  </div>
                )}

                {status === "error" ? (
                  <div className="flex flex-col gap-4 p-4 rounded-2xl bg-red-500/[0.02] border border-red-500/10">
                    <div className="flex items-start gap-3 text-red-500/70">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <p className="text-[12px] leading-relaxed font-medium">
                        {error || "An unexpected error occurred."}
                      </p>
                    </div>
                    
                    {errorType === "insufficient_funds" && (
                      <Link href="/settings">
                        <Button 
                          size="sm" 
                          className="w-full h-9 text-[11px] font-bold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 rounded-xl transition-all"
                        >
                          <Settings className="w-3.5 h-3.5 mr-2" />
                          Configure API Keys
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className={cn(
                      "relative transition-all duration-500 ease-in-out",
                      !isExpanded && "max-h-[300px] overflow-hidden"
                    )}>
                      {displayMarkdown ? (
                        <div className="relative">
                          <Markdown citations={mergedCitations}>{displayMarkdown}</Markdown>
                          {status === "streaming" && (
                            <>
                              <span className="inline-block w-1.5 h-4 ml-1 bg-primary/40 animate-pulse align-middle rounded-full" />
                              <span className="sr-only">Generando...</span>
                            </>
                          )}
                        </div>
                      ) : null}
                      
                      {!isExpanded && (
                        <div 
                          className={cn(
                            "absolute bottom-0 left-0 right-0 h-24 pointer-events-none",
                            color && GRADIENT_MAP[color] 
                              ? GRADIENT_MAP[color] 
                              : "bg-gradient-to-t from-white/90 dark:from-black/40 to-transparent"
                          )}
                        />
                      )}
                    </div>

                    {displayMarkdown.length > 500 && (
                      <div className="flex justify-center mt-2">
                        <button
                          onClick={() => updateNode(id, { contentCollapsed: contentCollapsed !== true })}
                          className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 hover:bg-primary/10 text-[11px] font-bold text-primary/70 hover:text-primary"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              Contraer
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              Expandir
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Citations: RLM + web search sources (shown when complete or when we have tool results) */}
              {mergedCitations.length > 0 && (status === "complete" || (toolOutput?.length ?? 0) > 0) && (
                <CitationDisplay citations={mergedCitations} />
              )}
            </>
          )}

          <div className="flex items-center justify-between pt-2 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-2">
              <div className="size-5 rounded-full bg-primary/5 flex items-center justify-center overflow-hidden grayscale opacity-80">
                {modelIcon ? (
                  <Image
                    src={theme === 'dark' ? modelIcon.light : modelIcon.dark}
                    alt={modelId}
                    width={14}
                    height={14}
                    className="object-contain opacity-90"
                  />
                ) : (
                  <Sparkles className="w-2.5 h-2.5 text-primary/70" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 leading-none">{modelId}</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {role && role !== 'context' && (
                    <span className="text-[8px] px-1 py-0.5 rounded-md bg-primary/5 text-primary/50 font-bold uppercase tracking-tighter border border-primary/5">
                      {role as string}
                    </span>
                  )}
                  {importance && importance !== 3 && (
                    <span className="text-[8px] px-1 py-0.5 rounded-md bg-amber-500/5 text-amber-600/50 font-bold border border-amber-500/5">
                      IMP: {importance as number}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Add to Knowledge Garden button */}
              {displayMarkdown && displayMarkdown.length >= 50 && status === "complete" && (
                <button
                  onClick={handleAddToKG}
                  disabled={isAddingToKG || addedToKG}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
                    addedToKG
                      ? "bg-emerald-500/10 text-emerald-500 cursor-default"
                      : "bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600/60 hover:text-emerald-500",
                    isAddingToKG && "opacity-50 cursor-wait"
                  )}
                  title={addedToKG ? "Added to Knowledge Garden" : "Add to Knowledge Garden"}
                >
                  {isAddingToKG ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : addedToKG ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Leaf className="w-3 h-3" />
                  )}
                  <span className="hidden sm:inline">{addedToKG ? "Added" : "Add to KG"}</span>
                </button>
              )}
              <div className="text-[10px] text-muted-foreground/40 font-medium">
                {createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : 'Just now'}
              </div>
            </div>
          </div>
        </div>

        <NodeHandle type="source" position={Position.Bottom} className="group-hover:!opacity-100" />
      </div>
    </div>
  );
});

ResponseNode.displayName = "ResponseNode";

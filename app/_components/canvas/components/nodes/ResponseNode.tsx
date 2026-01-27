import { memo, useMemo, useState, useCallback } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { Sparkles, Lock, ChevronDown, ChevronUp, Leaf, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import AIThinkingBlock from "@/components/ui/ai-thinking-block";
import { ShiningText } from "@/components/ui/shining-text";
import { Markdown } from "@/components/ui/markdown";
import Image from "next/image";
import { modelRegistry } from "@/shared/ai";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { NodeHandle } from "./NodeHandle";
import { AlertCircle, Settings, Check } from "lucide-react";
import Link from "next/link";
import { useCanvasStore, CanvasState } from "@/hooks/useCanvasStore";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { evaluateForKnowledge } from "@/lib/knowledge/evaluator";
import { usePathname } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";

import { ResponseNodeData } from "../../types";

const GRADIENT_MAP: Record<string, string> = {
  "rgba(59, 130, 246, 0.15)": "bg-gradient-to-t from-[#E2ECFE] dark:from-[#111B2E] to-transparent",
  "rgba(168, 85, 247, 0.15)": "bg-gradient-to-t from-[#F2E6FE] dark:from-[#21142E] to-transparent",
  "rgba(236, 72, 153, 0.15)": "bg-gradient-to-t from-[#FCE4F0] dark:from-[#2B1220] to-transparent",
  "rgba(234, 179, 8, 0.15)":  "bg-gradient-to-t from-[#FCF4DA] dark:from-[#2B230B] to-transparent",
};

export const ResponseNode = memo(({ id, data, selected }: NodeProps) => {
  const responseData = data as unknown as ResponseNodeData;
  const { 
    text, 
    modelId, 
    createdAt, 
    reasoning, 
    structuredReasoning,
    content,
    isProModel, 
    isUserFree, 
    status, 
    color, 
    error, 
    errorType,
    role,
    importance
  } = responseData;
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingToKG, setIsAddingToKG] = useState(false);
  const [addedToKG, setAddedToKG] = useState(false);
  const edges = useCanvasStore((state: CanvasState) => state.edges);
  const pathname = usePathname();
  const theme = useTheme().theme;

  // Extract canvasId from URL path (e.g., /canvas/abc123)
  const canvasIdFromPath = pathname?.split("/canvas/")?.[1]?.split("/")?.[0];
  const isLocked = isProModel && isUserFree;
  const { toast } = useToast();

  // Convex mutations for KG
  const createCandidate = useMutation(api.knowledge_garden.seedCandidates.createCandidate);
  const gardenSettings = useQuery(api.users.settings.getGardenSettings);

  // Normalize data (moved up for use in callback)
  const displayMarkdown = content?.markdown || text || "";
  const displayReasoning = structuredReasoning?.text || reasoning || "";

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

  const incomingEdges = useMemo(
    () => edges.filter(edge => edge.target === id),
    [edges, id]
  );
  const hasIncoming = incomingEdges.length > 0;

  const modelInfo = modelRegistry.getById(modelId || "");
  const modelIcon = modelInfo?.icon;

  return (
    <div className="group relative select-none">
      {hasIncoming && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 backdrop-blur-xl border border-primary/10 rounded-full animate-in fade-in slide-in-from-bottom-1 duration-500">
          <div className="size-1 rounded-full bg-primary/60 animate-pulse" />
          <span className="text-[9px] font-bold text-primary/60 uppercase tracking-wider">
            {incomingEdges.length}
          </span>
        </div>
      )}

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
        <NodeHandle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        
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
              {/* Reasoning Block or Shining Text */}
              {displayReasoning ? (
                <AIThinkingBlock reasoning={displayReasoning} modelName={modelInfo?.displayName || modelId} />
              ) : status === "thinking" ? (
                // If we have structuredReasoning object (even if empty text), it's a reasoning model -> AIThinkingBlock
                // Otherwise -> ShiningText
                structuredReasoning ? (
                   <AIThinkingBlock modelName={modelInfo?.displayName || modelId} />
                ) : (
                   <div className="flex items-center gap-2 p-4">
                      <ShiningText text={`${modelInfo?.displayName || modelId} is thinking...`} />
                   </div>
                )
              ) : null}

              {/* Main Content */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-[14px] leading-relaxed text-foreground/90 font-medium selection:bg-primary/20">
                {status === "streaming" && !displayMarkdown && (
                  <div className="flex items-center gap-2 text-muted-foreground/40 animate-pulse py-2">
                    <div className="size-1.5 rounded-full bg-primary animate-bounce" />
                    <span className="text-xs font-medium">Generating...</span>
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
                      !isExpanded && displayMarkdown.length > 500 && "max-h-[300px] overflow-hidden"
                    )}>
                      {displayMarkdown ? (
                        <div className="relative">
                          <Markdown>{displayMarkdown}</Markdown>
                          {status === "streaming" && (
                            <span className="inline-block w-1.5 h-4 ml-1 bg-primary/40 animate-pulse align-middle rounded-full" />
                          )}
                        </div>
                      ) : null}
                      
                      {!isExpanded && displayMarkdown.length > 500 && (
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
                          onClick={() => setIsExpanded(!isExpanded)}
                          className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 hover:bg-primary/10 text-[11px] font-bold text-primary/70 hover:text-primary"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              Collapse
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              Expand
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
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

        <NodeHandle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
});

ResponseNode.displayName = "ResponseNode";

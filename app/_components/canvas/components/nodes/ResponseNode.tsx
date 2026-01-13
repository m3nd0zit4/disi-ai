import { memo, useMemo, useState } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { Sparkles, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import AIThinkingBlock from "@/components/ui/ai-thinking-block";
import { ShiningText } from "@/components/ui/shining-text";
import { Markdown } from "@/components/ui/markdown";
import Image from "next/image";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { NodeHandle } from "./NodeHandle";
import { AlertCircle, Settings } from "lucide-react";
import Link from "next/link";
import { useCanvasStore, CanvasState } from "@/hooks/useCanvasStore";

import { ResponseNodeData } from "../../types";

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
  const edges = useCanvasStore((state: CanvasState) => state.edges);
  const theme = useTheme().theme;
  const isLocked = isProModel && isUserFree;

  const incomingEdges = useMemo(
    () => edges.filter(edge => edge.target === id),
    [edges, id]
  );
  const hasIncoming = incomingEdges.length > 0;

  const modelInfo = SPECIALIZED_MODELS.find(m => m.id === modelId);
  const modelIcon = modelInfo?.icon;

  // Normalize data
  const displayMarkdown = content?.markdown || text || "";
  const displayReasoning = structuredReasoning?.text || reasoning || "";
  
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
                <AIThinkingBlock reasoning={displayReasoning} modelName={modelInfo?.name || modelId} />
              ) : status === "thinking" ? (
                // If we have structuredReasoning object (even if empty text), it's a reasoning model -> AIThinkingBlock
                // Otherwise -> ShiningText
                structuredReasoning ? (
                   <AIThinkingBlock modelName={modelInfo?.name || modelId} />
                ) : (
                   <div className="flex items-center gap-2 p-4">
                      <ShiningText text={`${modelInfo?.name || modelId} is thinking...`} />
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
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/80 dark:from-black/40 to-transparent pointer-events-none" />
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
            <div className="text-[10px] text-muted-foreground/40 font-medium self-end pb-1">
              {createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : 'Just now'}
            </div>
          </div>
        </div>

        <NodeHandle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
});

ResponseNode.displayName = "ResponseNode";

import { memo, useState } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { Sparkles, ChevronRight, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { NodeHandle } from "./NodeHandle";
import { NodeToolbar } from "./NodeToolbar";
import { AlertCircle, Settings } from "lucide-react";
import Link from "next/link";

import { ResponseNodeData } from "../../types";

export const ResponseNode = memo(({ id, data, selected, dragging }: NodeProps) => {
  const { text, modelId, createdAt, reasoning, isProModel, isUserFree, status, color, error, errorType } = data as unknown as ResponseNodeData;
  const [showReasoning, setShowReasoning] = useState(false);
  const { theme } = useTheme();
  const isLocked = isProModel && isUserFree;

  const modelInfo = SPECIALIZED_MODELS.find(m => m.id === modelId);
  const modelIcon = modelInfo?.icon;

  return (
    <div className="group relative select-none">
      <NodeToolbar nodeId={id} isVisible={selected && !dragging} data={data} showRegenerate={true} />
      <div 
        className={cn(
          "min-w-[300px] max-w-[550px] backdrop-blur-2xl transition-all duration-500 rounded-[2rem] overflow-hidden border border-primary/5",
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
              {reasoning && (
                <div className="space-y-3">
                  <button 
                    onClick={() => setShowReasoning(!showReasoning)}
                    className="flex items-center gap-2 text-muted-foreground/50 hover:text-primary transition-all group/btn"
                  >
                    <div className="size-5 rounded-full bg-primary/5 flex items-center justify-center group-hover/btn:bg-primary/10 transition-colors">
                      <Sparkles className="w-2.5 h-2.5" />
                    </div>
                    <span className="text-[10px] font-bold tracking-tight uppercase">Reasoning</span>
                    <ChevronRight className={cn("w-2.5 h-2.5 transition-transform duration-300", showReasoning ? 'rotate-90' : '')} />
                  </button>

                  {showReasoning && (
                    <div className="p-4 rounded-2xl bg-primary/[0.03] border border-primary/5 text-[12px] text-muted-foreground/80 italic leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
                      {reasoning}
                    </div>
                  )}
                </div>
              )}

              <div className="prose prose-sm dark:prose-invert max-w-none text-[14px] leading-relaxed text-foreground/90 font-medium selection:bg-primary/20">
                {status === "thinking" && !text && (
                  <div className="flex items-center gap-2 text-muted-foreground/40 animate-pulse py-2">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs font-medium">Thinking...</span>
                  </div>
                )}
                {status === "streaming" && !text && (
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
                  <>
                    {text ? (
                      <div className="relative">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                          {text}
                        </ReactMarkdown>
                        {status === "streaming" && text && (
                          <span className="inline-block w-1.5 h-4 ml-1 bg-primary/40 animate-pulse align-middle rounded-full" />
                        )}
                      </div>
                    ) : null}
                  </>
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{modelId}</span>
            </div>
            <div className="text-[10px] text-muted-foreground/40 font-medium">
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

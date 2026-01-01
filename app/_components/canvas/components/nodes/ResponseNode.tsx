import { memo, useState } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { ResponseNodeData } from "../../types";
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

export const ResponseNode = memo(({ data, selected }: NodeProps) => {
  const { text, modelId, createdAt, reasoning, isProModel, isUserFree, status } = data as unknown as ResponseNodeData;
  const [showReasoning, setShowReasoning] = useState(false);
  const { theme } = useTheme();
  const isLocked = isProModel && isUserFree;

  const modelInfo = SPECIALIZED_MODELS.find(m => m.id === modelId);
  const modelIcon = modelInfo?.icon;

  return (
    <Card className={cn(
      "min-w-[300px] max-w-[550px] border border-primary/10 bg-secondary/50 dark:bg-card/90 backdrop-blur-xl transition-all duration-300 rounded-2xl overflow-hidden",
      selected ? "ring-2 ring-primary/50 border-primary/50 shadow-2xl shadow-primary/30 z-50" : "shadow-sm hover:border-primary/20"
    )}>
      <NodeHandle type="target" position={Position.Top} />
      
      <div className="p-4 space-y-3.5">
        {isLocked ? (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center space-y-3">
            <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary/70">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[12px] font-bold text-foreground/90">Unlock Advanced Models</h3>
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                Requires a <span className="text-primary font-bold">Professional plan</span>.
              </p>
            </div>
            <Button className="w-full bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold h-8 rounded-lg border border-primary/10">
              Subscribe Now
            </Button>
          </div>
        ) : (
          <>
            {reasoning && (
              <div className="space-y-2">
                <button 
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="flex items-center gap-2 text-muted-foreground/70 hover:text-primary transition-colors group"
                >
                  <div className="size-5 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Sparkles className="w-2.5 h-2.5" />
                  </div>
                  <span className="text-[10px] font-bold tracking-tight">Reasoning Process</span>
                  <ChevronRight className={cn("w-2.5 h-2.5 transition-transform duration-200", showReasoning ? 'rotate-90' : '')} />
                </button>

                {showReasoning && (
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/10 text-[11px] text-muted-foreground/80 italic leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                    {reasoning}
                  </div>
                )}
              </div>
            )}

            <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed text-foreground/90 font-medium">
              {status === "thinking" && !text && (
                <div className="flex items-center gap-2 text-muted-foreground/50 animate-pulse">
                  <Sparkles className="w-3 h-3 animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
              {status === "streaming" && !text && (
                <div className="flex items-center gap-2 text-muted-foreground/50 animate-pulse">
                  <div className="size-1.5 rounded-full bg-primary animate-bounce" />
                  <span>Generating...</span>
                </div>
              )}
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {text}
              </ReactMarkdown>
              {status === "streaming" && text && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-primary/50 animate-pulse align-middle" />
              )}
            </div>
          </>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-primary/10">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
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
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">{modelId}</span>
          </div>
          <div className="text-[9px] text-muted-foreground/40 font-medium">
            {createdAt ? formatDistanceToNow(createdAt) : 'Just now'}
          </div>
        </div>
      </div>

      <NodeHandle type="source" position={Position.Bottom} />
    </Card>
  );
});

ResponseNode.displayName = "ResponseNode";

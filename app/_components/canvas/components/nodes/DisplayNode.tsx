import { memo } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { NodeHandle } from "./NodeHandle";
import { NodeToolbar } from "./NodeToolbar";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import Image from "next/image";
import { useTheme } from "next-themes";
import { DisplayNodeData } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { formatDistanceToNow } from "date-fns";

export const DisplayNode = memo(({ id, data, selected, dragging }: NodeProps) => {
  const { type, content, text, mediaUrl, status, modelId, createdAt, color } = data as unknown as DisplayNodeData;
  const modelInfo = SPECIALIZED_MODELS.find(m => m.id === modelId);
  const { theme } = useTheme();
  const modelIcon = modelInfo?.icon;

  const displayContent = content || text;
  const isPending = status === "pending" || status === "thinking";
  const isStreaming = status === "streaming";

  // Determine the effective type if missing
  const effectiveType = type || (mediaUrl ? "image" : (displayContent ? "text" : undefined));

  return (
    <div className="group relative select-none">
      {/* Node Toolbar Overlay - Floating above */}
      <NodeToolbar nodeId={id} isVisible={selected && !dragging} data={data} />

      {/* Main Node Content - The "Image" IS the Node */}
      <div 
        className={cn(
          "relative min-w-[200px] transition-all duration-500 rounded-[2rem] overflow-hidden border border-primary/5",
          (!color || color === 'transparent') && "bg-white/80 dark:bg-white/[0.05]",
          selected ? "ring-2 ring-primary/30 shadow-[0_30px_60px_rgba(0,0,0,0.2)] z-50 scale-[1.02]" : "shadow-lg hover:border-primary/10",
          dragging && "opacity-80"
        )}
        style={{ 
          backgroundColor: color && color !== 'transparent' ? color : undefined,
          borderColor: color && color !== 'transparent' ? color.replace('0.15', '0.3') : undefined
        }}
      >
        {/* Top Handle Overlay */}
        <NodeHandle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity z-10" />
        
        {/* Content Area */}
        <div className="relative w-full h-full">
          {/* Loading States Overlay */}
          {(isPending || (isStreaming && !mediaUrl)) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/40 backdrop-blur-md py-12">
              <div className="relative">
                <Sparkles className="w-8 h-8 text-primary/20 animate-spin duration-[3000ms]" />
                <Sparkles className="absolute inset-0 w-8 h-8 text-primary/40 animate-pulse" />
              </div>
              <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-primary/40 animate-pulse">
                {status === "streaming" ? "Generating..." : "Thinking..."}
              </p>
            </div>
          )}

          {/* Image Content - The Core Visual */}
          {effectiveType === "image" && mediaUrl && (
            <div className="relative w-full bg-black/5">
              <img 
                src={mediaUrl} 
                alt="Generated content" 
                className="w-full h-auto block transition-transform duration-1000 group-hover:scale-105"
              />
              {/* Subtle Inner Shadow Overlay */}
              <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.1)] pointer-events-none" />
            </div>
          )}

          {/* Video Content */}
          {effectiveType === "video" && mediaUrl && (
            <div className="relative w-full bg-black/5">
              <video 
                src={mediaUrl} 
                controls
                muted
                playsInline
                loop
                className="w-full h-auto block"
              />
            </div>
          )}

          {/* Text Content Overlay (if any) */}
          {effectiveType === "text" && displayContent && (
            <div className="p-8 text-[15px] leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap selection:bg-primary/20">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {displayContent}
              </ReactMarkdown>
            </div>
          )}

          {/* Model Info Overlay - Bottom Minimal */}
          {modelId && (
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
                {modelIcon && (
                  <Image 
                    src={theme === 'dark' ? modelIcon.light : modelIcon.dark} 
                    alt={modelId} 
                    width={12} 
                    height={12}
                    className="opacity-80"
                  />
                )}
                <span className="text-[9px] font-medium text-white/70 tracking-tight">
                  {modelId}
                </span>
              </div>
              
              {createdAt && (
                <div className="text-[9px] text-white/50 font-medium bg-black/20 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Handle Overlay */}
        <NodeHandle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity z-10" />
      </div>
    </div>
  );
});

DisplayNode.displayName = "DisplayNode";

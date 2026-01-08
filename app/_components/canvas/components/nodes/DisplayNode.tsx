import React, { memo, useState, useEffect } from "react";
import { Position, NodeProps } from "@xyflow/react";
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
import { ImageGeneration } from "@/components/ui/ai-chat-image-generation";
import { useCanvasStore, CanvasState } from "@/hooks/useCanvasStore";

export const DisplayNode = memo(({ id, data, selected, dragging }: NodeProps) => {
  const displayData = data as DisplayNodeData;
  const { type, content, text, mediaUrl, mediaStorageId, status, modelId, createdAt, color, role, importance } = displayData;
  const selectedNodeIdForToolbar = useCanvasStore((state: CanvasState) => state.selectedNodeIdForToolbar);
  const edges = useCanvasStore((state: CanvasState) => state.edges);
  const modelInfo = SPECIALIZED_MODELS.find(m => m.id === modelId);
  const { theme } = useTheme();
  const modelIcon = modelInfo?.icon;

  const incomingEdges = edges.filter(edge => edge.target === id);
  const hasIncoming = incomingEdges.length > 0;

  const [signedUrl, setSignedUrl] = useState<string | null>(mediaUrl || null);

  useEffect(() => {
    if (!signedUrl && mediaStorageId) {
      fetch(`/api/file?key=${encodeURIComponent(mediaStorageId)}`)
        .then(res => res.json())
        .then(data => {
          if (data.url) setSignedUrl(data.url);
        })
        .catch(err => console.error("Failed to load media URL", err));
    }
  }, [mediaStorageId, signedUrl]);

  const displayContent = content || text;
  const isPending = status === "pending" || status === "thinking";
  const isStreaming = status === "streaming";
  const isResolvingUrl = !!mediaStorageId && !signedUrl;
  const showLoading = isPending || (isStreaming && !signedUrl) || isResolvingUrl;

  // Determine the effective type if missing
  const effectiveType = type || (mediaUrl || mediaStorageId ? "image" : (displayContent ? "text" : undefined));

  return (
    <div className="group relative select-none">
      {/* Node Toolbar Overlay - Floating above */}
      <NodeToolbar 
        nodeId={id} 
        isVisible={selectedNodeIdForToolbar === id} 
        data={data} 
        hideColors={effectiveType === 'image'} 
      />

      {hasIncoming && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 backdrop-blur-xl border border-primary/10 rounded-full animate-in fade-in slide-in-from-bottom-1 duration-500 z-30">
          <div className="size-1 rounded-full bg-primary/60 animate-pulse" />
          <span className="text-[9px] font-bold text-primary/60 uppercase tracking-wider">
            {incomingEdges.length}
          </span>
        </div>
      )}

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
          {/* Image Content - The Core Visual */}
          {effectiveType === "image" && (
            <div className="relative w-full h-full">
              {/* If we have a signedUrl, we show the image. 
                  If it's loading/streaming, we wrap it in ImageGeneration with appropriate state.
                  If it's completed, we just show the image (or wrap in completed ImageGeneration if we want the effect).
                  For now, let's wrap it if it's new or loading. */}
              
              {showLoading ? (
                 <ImageGeneration loadingState={status === "streaming" ? "generating" : "starting"}>
                    {signedUrl ? (
                      <img 
                        src={signedUrl} 
                        alt="Generated content" 
                        className="w-full h-auto block rounded-xl"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-muted/20 rounded-xl" /> // Placeholder while waiting for URL
                    )}
                 </ImageGeneration>
              ) : (
                signedUrl && (
                  <img 
                    src={signedUrl} 
                    alt="Generated content" 
                    className="w-full h-auto block transition-transform duration-1000 group-hover:scale-105 rounded-[2rem]"
                  />
                )
              )}
            </div>
          )}

          {/* Video Content */}
          {effectiveType === "video" && signedUrl && (
            <div className="relative w-full bg-black/5">
              <video 
                src={signedUrl} 
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
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
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
                <div className="flex items-center gap-1.5">
                  {role && role !== 'context' && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/80 font-semibold uppercase tracking-wider border border-white/10 backdrop-blur-md">
                      {role as string}
                    </span>
                  )}
                  {importance && importance !== 3 && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200/90 font-semibold border border-amber-500/20 backdrop-blur-md">
                      Imp: {importance as number}
                    </span>
                  )}
                </div>
              </div>
              
              {createdAt && (
                <div className="text-[9px] text-white/50 font-medium bg-black/20 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 self-end">
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

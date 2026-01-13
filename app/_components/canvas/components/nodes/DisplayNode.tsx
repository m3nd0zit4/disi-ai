import React, { memo, useState, useEffect } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { NodeHandle } from "./NodeHandle";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import Image from "next/image";
import { useTheme } from "next-themes";
import { DisplayNodeData } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { formatDistanceToNow } from "date-fns";
import { useCanvasStore, CanvasState } from "@/hooks/useCanvasStore";
import { Maximize2 } from "lucide-react";
import { Dialog } from "../../../ui/Dialog";

export const DisplayNode = memo(({ id, data, selected, dragging }: NodeProps) => {
  const displayData = data as unknown as DisplayNodeData;
  const { type, content, text, mediaUrl, mediaStorageId, status, modelId, createdAt, color, role, importance } = displayData;
  const edges = useCanvasStore((state: CanvasState) => state.edges);
  const modelInfo = SPECIALIZED_MODELS.find(m => m.id === modelId);
  const { theme } = useTheme();
  const modelIcon = modelInfo?.icon;

  const incomingEdges = edges.filter(edge => edge.target === id);
  const hasIncoming = incomingEdges.length > 0;

  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    // Fetch fresh signed URL whenever mediaStorageId is present
    if (mediaStorageId) {
      fetch(`/api/file?key=${encodeURIComponent(mediaStorageId)}`, { signal: controller.signal })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to fetch signed URL: ${res.status} ${res.statusText}`);
          }
          return res.json();
        })
        .then(data => {
          if (!controller.signal.aborted && data.url) {
            setFetchedUrl(data.url);
          }
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.error("Failed to load media URL", err);
          }
        });
    }

    return () => controller.abort();
  }, [mediaStorageId]);

  const signedUrl = mediaStorageId ? fetchedUrl : (mediaUrl || null);

  const displayContent = content || text;
  const isPending = status === "pending" || status === "thinking";
  const isStreaming = status === "streaming";
  const isResolvingUrl = !!mediaStorageId && !signedUrl;
  const showLoading = isPending || (isStreaming && !signedUrl) || isResolvingUrl;

  // Determine the effective type if missing
  const effectiveType = type || (mediaUrl || mediaStorageId ? "image" : (displayContent ? "text" : undefined));

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Viewport dimensions for images
  const VIEWPORT_WIDTH = 300;

  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(
    displayData.metadata?.width && displayData.metadata?.height 
      ? { width: displayData.metadata.width, height: displayData.metadata.height }
      : null
  );

  const updateNodeData = useCanvasStore((state: CanvasState) => state.updateNodeData);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    const { naturalWidth, naturalHeight } = img;
    
    if (!dimensions || dimensions.width !== naturalWidth || dimensions.height !== naturalHeight) {
      const newDimensions = { width: naturalWidth, height: naturalHeight };
      setDimensions(newDimensions);
      
      // Persist to store/DB
      updateNodeData(id, { 
        metadata: { 
          ...displayData.metadata,
          width: naturalWidth, 
          height: naturalHeight 
        } 
      });
    }
  };

  const aspectRatio = (dimensions && dimensions.width > 0) ? dimensions.height / dimensions.width : 1;
  const nodeHeight = (dimensions && dimensions.width > 0) ? VIEWPORT_WIDTH * aspectRatio : 200;

  return (
    <div className="group relative select-none">
      {hasIncoming && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 backdrop-blur-xl border border-primary/10 rounded-full animate-in fade-in slide-in-from-bottom-1 duration-500 z-30">
          <div className="size-1 rounded-full bg-primary/60 animate-pulse" />
          <span className="text-[9px] font-bold text-primary/60 uppercase tracking-wider">
            {incomingEdges.length}
          </span>
        </div>
      )}

      {/* Main Node Content */}
      <div 
        className={cn(
          "relative transition-all duration-500 rounded-[1.5rem] overflow-hidden border border-primary/5",
          (!color || color === 'transparent') && "bg-white/80 dark:bg-white/[0.05]",
          selected ? "ring-2 ring-primary/30 shadow-[0_30px_60px_rgba(0,0,0,0.2)] z-50 scale-[1.02]" : "shadow-lg hover:border-primary/10",
          dragging && "opacity-80"
        )}
        style={{ 
          backgroundColor: color && color !== 'transparent' ? color : undefined,
          borderColor: color && color !== 'transparent' ? color.replace('0.15', '0.3') : undefined,
          width: effectiveType === "image" ? VIEWPORT_WIDTH : "auto",
          minWidth: effectiveType === "text" ? "200px" : undefined,
        }}
      >
        {/* Top Handle Overlay */}
        <NodeHandle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity z-10" />
        
        {/* Content Area */}
        <div className="relative w-full h-full">
          {/* Image Content - The Core Visual */}
          {effectiveType === "image" && (
            <div 
              className="relative overflow-hidden bg-muted/5"
              style={{ 
                width: VIEWPORT_WIDTH, 
                height: nodeHeight,
              }}
            >
              {showLoading ? (
                 <div 
                   className="w-full h-full flex items-center justify-center bg-muted/5 animate-pulse"
                 >
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <div className="size-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      </div>
                      <span className="text-[8px] font-bold text-primary/40 uppercase tracking-[0.2em]">
                        {status === "thinking" ? "Thinking..." : "Generating..."}
                      </span>
                    </div>
                 </div>
              ) : (
                signedUrl && (
                  <div className="relative group/img w-full h-full">
                    <img 
                      src={signedUrl} 
                      alt="Generated content" 
                      onLoad={handleImageLoad}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.02]"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLightboxOpen(true);
                      }}
                      className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 hover:bg-black/60"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          {/* Lightbox Dialog */}
          {signedUrl && (
            <Dialog
              isOpen={isLightboxOpen}
              onClose={() => setIsLightboxOpen(false)}
              title="Image Preview"
              description=""
              type="info"
            >
              <div className="mt-4 relative rounded-xl overflow-hidden bg-black/5">
                <img 
                  src={signedUrl} 
                  alt="Full size preview" 
                  className="w-full h-auto block"
                />
              </div>
            </Dialog>
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
            <div className={cn(
              "absolute bottom-3 left-3 right-3 flex items-center justify-between transition-opacity duration-300 pointer-events-none z-20",
              effectiveType === "image" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                  {modelIcon && (
                    <Image 
                      src={theme === 'dark' ? modelIcon.light : modelIcon.dark} 
                      alt={modelId} 
                      width={10} 
                      height={10}
                      className="opacity-80"
                    />
                  )}
                  <span className="text-[8px] font-bold text-white/70 tracking-tight">
                    {modelId}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {role && role !== 'context' && (
                    <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/80 font-bold uppercase tracking-wider border border-white/10 backdrop-blur-md">
                      {role}
                    </span>
                  )}
                  {importance && importance !== 3 && (
                    <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200/90 font-bold border border-amber-500/20 backdrop-blur-md">
                      Imp: {importance}
                    </span>
                  )}
                </div>
              </div>
              
              {createdAt && (
                <div className="text-[8px] text-white/50 font-bold bg-black/20 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 self-end">
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

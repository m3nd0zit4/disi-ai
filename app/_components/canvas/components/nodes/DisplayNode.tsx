import React, { memo, useState } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { cn, adjustAlpha } from "@/lib/utils";
import { NodeHandle } from "./NodeHandle";
import { modelRegistry } from "@/shared/ai";
import { DisplayNodeData } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { formatDistanceToNow } from "date-fns";
import { useCanvasStore, CanvasState } from "@/hooks/useCanvasStore";
import { Maximize2, GripVertical, Trash2, Download, Plus } from "lucide-react";
import { Dialog } from "../../../ui/Dialog";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { useConnections } from "../../providers/ConnectionsProvider";
import { LoadingVisualCard } from "../../../ui/LoadingVisualCard";

export const DisplayNode = memo(({ id, data, selected, dragging }: NodeProps) => {
  const displayData = data as unknown as DisplayNodeData;
  const { type, content, text, mediaUrl, mediaStorageId, status, modelId, createdAt, color, role, importance } = displayData;
  const { deleteNode } = useConnections();
  const duplicateNode = useCanvasStore((state: CanvasState) => state.duplicateNode);

  const signedUrl = useSignedUrl(mediaStorageId, mediaUrl);

  const displayContent = content || text;
  const isPending = status === "pending" || status === "thinking";
  const isStreaming = status === "streaming";
  const isResolvingUrl = !!mediaStorageId && !signedUrl;
  const showLoading = isPending || (isStreaming && !signedUrl) || isResolvingUrl;

  // Determine the effective type if missing
  const effectiveType = type || (mediaUrl || mediaStorageId ? "image" : (displayContent ? "text" : undefined));
  const isMedia = effectiveType === "image" || effectiveType === "video";

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Viewport dimensions for images/videos
  const VIEWPORT_WIDTH = 350;

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

  const handleVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    const { videoWidth, videoHeight } = video;
    
    if (!dimensions || dimensions.width !== videoWidth || dimensions.height !== videoHeight) {
      const newDimensions = { width: videoWidth, height: videoHeight };
      setDimensions(newDimensions);
      
      // Persist to store/DB
      updateNodeData(id, { 
        metadata: { 
          ...displayData.metadata,
          width: videoWidth, 
          height: videoHeight 
        } 
      });
    }
  };

  const aspectRatio = (dimensions && dimensions.width > 0) ? dimensions.height / dimensions.width : 1;
  const nodeHeight = (dimensions && dimensions.width > 0) ? VIEWPORT_WIDTH * aspectRatio : 200;

  return (
    <div className="group relative select-none">
      {/* Main Node Content */}
      <div 
        className={cn(
          "relative transition-all duration-500 rounded-[1.5rem] overflow-hidden border border-primary/5",
          (!color || color === 'transparent') && (isMedia ? "bg-black" : "bg-white/80 dark:bg-white/[0.05]"),
          selected ? "ring-2 ring-primary/30 shadow-[0_30px_60px_rgba(0,0,0,0.2)] z-50 scale-[1.02]" : "shadow-lg hover:border-primary/10",
          dragging && "opacity-80"
        )}
        style={{ 
          backgroundColor: color && color !== 'transparent' ? color : undefined,
          borderColor: color && color !== 'transparent' ? adjustAlpha(color, 0.3) : undefined,
          width: isMedia ? VIEWPORT_WIDTH : "auto",
          height: isMedia ? nodeHeight : "auto",
          minWidth: effectiveType === "text" ? "200px" : undefined,
        }}
      > 
        <NodeHandle type="target" position={Position.Top} className="group-hover:!opacity-100 z-10" />

        {/* Content Area */}
        <div className="relative w-full h-full">
          {/* Media Content - Image or Video */}
          {isMedia && (
            <div 
              className="relative overflow-hidden bg-muted/5"
              style={{ 
                width: VIEWPORT_WIDTH, 
                height: nodeHeight,
              }}
            >
              {showLoading ? (
                <LoadingVisualCard 
                  mode={effectiveType as 'image' | 'video'}
                  statusMessage={
                    status === "thinking" ? "Consulting the digital oracle..." :
                    status === "streaming" ? "Weaving pixels into reality..." :
                    effectiveType === "video" ? "Directing your scene..." :
                    "Painting your imagination..."
                  }
                  progress={displayData.progress}
                  backgroundVisual={signedUrl ? (
                    effectiveType === "image" ? (
                      <img src={signedUrl} className="w-full h-full object-cover" alt="Loading preview" />
                    ) : (
                      <video src={signedUrl} className="w-full h-full object-cover" />
                    )
                  ) : undefined}
                />
              ) : (
                signedUrl && (
                  <div className="relative group/media w-full h-full animate-in fade-in zoom-in-95 duration-700">
                    {effectiveType === "image" ? (
                      <>
                        <img
                          src={signedUrl}
                          alt="Generated content"
                          onLoad={handleImageLoad}
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover/media:scale-[1.02]"
                        />
                        {/* Custom Hover Overlay for Actions */}
                        <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/20 transition-all duration-300 flex items-center justify-center gap-3 opacity-0 group-hover/media:opacity-100">
                          <HoverActionButton
                            icon={<Maximize2 size={16} />}
                            onClick={() => setIsLightboxOpen(true)}
                            tooltip="Maximize"
                          />
                          <HoverActionButton
                            icon={<Plus size={16} />}
                            onClick={() => duplicateNode(id)}
                            tooltip="Duplicate"
                          />
                          <HoverActionButton
                            icon={<Download size={16} />}
                            onClick={() => signedUrl && window.open(signedUrl, '_blank')}
                            tooltip="Download"
                          />
                          <HoverActionButton
                            icon={<Trash2 size={16} />}
                            onClick={() => deleteNode(id)}
                            tooltip="Delete"
                            variant="destructive"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="relative w-full h-full bg-black">
                        <video 
                          key={signedUrl}
                          src={signedUrl} 
                          controls
                          autoPlay
                          muted
                          playsInline
                          loop
                          onLoadedMetadata={handleVideoLoad}
                          onError={(e) => {
                            console.error("Video playback error:", e);
                          }}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-[8px] font-bold text-white/80 uppercase tracking-wider pointer-events-none">
                          Video
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Lightbox Dialog */}
          {signedUrl && effectiveType === "image" && (
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
              
              {createdAt && !isNaN(new Date(createdAt).getTime()) && (
                <div className="text-[8px] text-white/50 font-bold bg-black/20 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 self-end">
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Handle Overlay */}
        <NodeHandle type="source" position={Position.Bottom} className="group-hover:!opacity-100 z-10" />
      </div>
    </div>
  );
});

DisplayNode.displayName = "DisplayNode";

interface HoverActionButtonProps {
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  tooltip: string;
  variant?: "default" | "destructive";
}

const HoverActionButton = ({ icon, onClick, tooltip, variant = "default" }: HoverActionButtonProps) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick(e);
    }}
    title={tooltip}
    className={cn(
      "p-2.5 rounded-full backdrop-blur-xl border shadow-2xl transform scale-90 group-hover/media:scale-100 transition-all duration-300 hover:scale-110",
      variant === "default" 
        ? "bg-white/10 border-white/20 text-white hover:bg-white/20" 
        : "bg-red-500/20 border-red-500/30 text-red-200 hover:bg-red-500/30"
    )}
  >
    {icon}
  </button>
);

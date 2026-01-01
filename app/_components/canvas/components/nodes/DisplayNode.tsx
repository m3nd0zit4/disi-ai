import { memo } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { DisplayNodeData } from "../../types";
import { Eye, Download, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { NodeHandle } from "./NodeHandle";

export const DisplayNode = memo(({ data, selected }: NodeProps) => {
  const { type, content, mediaUrl } = data as unknown as DisplayNodeData;

  return (
    <Card className={cn(
      "min-w-[300px] max-w-[450px] border border-primary/10 bg-secondary/50 dark:bg-card/90 backdrop-blur-xl transition-all duration-300 rounded-2xl overflow-hidden",
      selected ? "ring-2 ring-primary/50 border-primary/50 shadow-2xl shadow-primary/30 z-50" : "shadow-sm hover:border-primary/20"
    )}>
      <NodeHandle type="target" position={Position.Top} />
      
      <div className="relative group">
        {!content && !mediaUrl ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/30">
            <Eye className="w-6 h-6 mb-2 opacity-20" />
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">Awaiting Content</span>
          </div>
        ) : (
          <div className="space-y-0">
            {type === "text" && content && (
              <div className="p-4 text-[13px] leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap">
                {content}
              </div>
            )}
            {(type === "image" || type === "video") && mediaUrl && (
              <div className="relative aspect-video bg-primary/10 overflow-hidden">
                <Image 
                  src={mediaUrl} 
                  alt="Generated content" 
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3 gap-2">
                  <Button variant="secondary" size="icon" className="h-7 w-7 bg-white/10 backdrop-blur-md border-white/10 hover:bg-white/20 text-white rounded-lg">
                    <Maximize2 className="w-3 h-3" />
                  </Button>
                  <Button variant="secondary" size="icon" className="h-7 w-7 bg-white/10 backdrop-blur-md border-white/10 hover:bg-white/20 text-white rounded-lg">
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-primary/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500/70">
            <Eye className="w-2.5 h-2.5" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Display</span>
        </div>
        <div className="text-[9px] text-muted-foreground/40 font-medium">
          Just now
        </div>
      </div>

      <NodeHandle type="source" position={Position.Bottom} />
    </Card>
  );
});

DisplayNode.displayName = "DisplayNode";

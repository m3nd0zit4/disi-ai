import React, { memo } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { File, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NodeHandle } from "../NodeHandle";
import { FileNodeData } from "../../../types";
import Image from "next/image";

const isImageType = (type: string) => type.startsWith("image/");

export const PreviewFileNode = memo(({ data, selected }: NodeProps) => {
  const fileData = data as unknown as FileNodeData;
  const { fileName, fileType, uploadStatus, previewUrl } = fileData;

  return (
    <div className="group relative select-none animate-pulse">
      <div 
        className={cn(
          "w-[350px] backdrop-blur-md transition-all duration-300 rounded-xl overflow-hidden border-2 border-dashed border-primary/40 bg-primary/5 opacity-80",
          selected ? "ring-1 ring-primary/30 shadow-lg" : "shadow-sm"
        )}
      >
        <NodeHandle type="target" position={Position.Top} />
        
        <div className="p-3 flex flex-col gap-2">
          {isImageType(fileType) && previewUrl ? (
            <div className="relative w-full aspect-auto min-h-[100px] max-h-[300px] rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center">
              <Image src={previewUrl} alt={fileName} width={400} height={300} className="w-full h-auto max-h-full object-contain opacity-70" unoptimized />
            </div>
          ) : (
            <div className="flex items-center justify-center h-16 bg-muted/30 rounded-lg">
              <File className="size-6 text-muted-foreground/50" />
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground/90 truncate">
                {fileName}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="uppercase tracking-wider opacity-70">{fileType.split("/")[1]?.slice(0, 4) || "FILE"}</span>
              </div>
            </div>
            
            {uploadStatus === "uploading" && (
              <Loader2 className="size-3 text-primary animate-spin" />
            )}
          </div>
        </div>

        <NodeHandle type="source" position={Position.Bottom} />
      </div>
    </div>
  );
});

PreviewFileNode.displayName = "PreviewFileNode";

"use client";

import React, { memo, useState } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { FileText, Image as ImageIcon, File, Loader2, AlertCircle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { NodeHandle } from "./NodeHandle";
import { FileNodeData } from "../../types";
import { Button } from "@/components/ui/button";
import Image from "next/image";

import { formatFileSize, isImageType, isTextualType } from "@/lib/file-utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";

// Render the appropriate icon based on file type
const FileIconDisplay = ({ fileType, className }: { fileType: string; className?: string }) => {
  if (isImageType(fileType)) return <ImageIcon className={className} />;
  if (isTextualType(fileType)) return <FileText className={className} />;
  return <File className={className} />;
};

export const FileNode = memo(({ data, selected }: NodeProps) => {
  const fileData = data as unknown as FileNodeData;
  const { fileName, fileType, fileSize, storageId, uploadStatus, textContent, previewUrl } = fileData;
  
  const signedUrl = useSignedUrl(storageId, previewUrl);
  const [isExpanded, setIsExpanded] = useState(false);


  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (signedUrl) window.open(signedUrl, "_blank");
  };

  return (
    <div className="group relative select-none">
      <div 
        className={cn(
          "w-[350px] bg-card/80 backdrop-blur-md transition-all duration-300 rounded-xl overflow-hidden border",
          uploadStatus === "error" ? "border-red-500/30" : "border-border/50",
          selected ? "ring-1 ring-primary/30 shadow-lg" : "shadow-sm hover:border-primary/20"
        )}
      >
        <NodeHandle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Minimalist Content */}
        <div className="p-3 flex flex-col gap-2">
          {/* Preview Area */}
          {isImageType(fileType) && signedUrl ? (
            <div 
              className="relative w-full aspect-auto min-h-[100px] max-h-[300px] rounded-lg overflow-hidden bg-muted/50 cursor-pointer group/preview flex items-center justify-center"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Image src={signedUrl} alt={fileName} width={400} height={300} className="w-full h-auto max-h-full object-contain transition-transform duration-500 group-hover/preview:scale-105" unoptimized />
              <div className="absolute inset-0 bg-black/0 group-hover/preview:bg-black/10 transition-colors" />
            </div>
          ) : isTextualType(fileType) && textContent ? (
            <div 
              className={cn(
                "text-[9px] font-mono text-muted-foreground bg-muted/50 rounded-lg p-2 cursor-pointer hover:bg-muted/80 transition-colors",
                isExpanded ? "max-h-48 overflow-y-auto" : "max-h-20 overflow-hidden"
              )}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <pre className="whitespace-pre-wrap break-words">
                {isExpanded ? textContent : (
                  <>
                    {textContent.slice(0, 150)}
                    {textContent.length > 150 && <span className="text-muted-foreground/50">...</span>}
                  </>
                )}
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-16 bg-muted/30 rounded-lg">
              <FileIconDisplay fileType={fileType} className="size-6 text-muted-foreground/50" />
            </div>
          )}

          {/* Info Row */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground/90 truncate" title={fileName}>
                {fileName}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="uppercase tracking-wider opacity-70">{fileType.split("/")[1]?.slice(0, 4) || "FILE"}</span>
                <span className="size-0.5 rounded-full bg-muted-foreground/50" />
                <span>{formatFileSize(fileSize)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
               {uploadStatus === "uploading" ? (
                <Loader2 className="size-3 text-blue-400 animate-spin" />
              ) : uploadStatus === "error" ? (
                <AlertCircle className="size-3 text-red-400" />
              ) : (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="size-6 h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary" 
                  onClick={handleDownload}
                  disabled={!signedUrl}
                >
                  <Download className="size-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <NodeHandle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
});

FileNode.displayName = "FileNode";

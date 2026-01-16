import React, { memo } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { NodeHandle } from "../NodeHandle";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { InputNodeData } from "../../../types";

export const PreviewInputNode = memo(({ data, selected }: NodeProps) => {
  const inputData = data as unknown as InputNodeData;
  const { text } = inputData;
  const { user } = useUser();

  return (
    <div className="group relative select-none">
      <div 
        className={cn(
          "w-[350px] backdrop-blur-2xl rounded-[2rem] overflow-hidden border-2 border-dashed border-primary/40 bg-primary/5 opacity-80",
          selected ? "ring-1 ring-primary/30 shadow-lg" : "shadow-sm"
        )}
      >
        <NodeHandle type="target" position={Position.Top} />
        
        <div className="p-6 space-y-4">
          <div className="prose prose-sm dark:prose-invert max-w-none text-[14px] leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap min-h-[1.5em]">
            {text || <span className="text-muted-foreground/50 italic">Escribe tu prompt aquí...</span>}
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {user?.imageUrl ? (
                  <Image 
                    src={user.imageUrl} 
                    alt={user.fullName || "User"} 
                    width={20} 
                    height={20} 
                    className="object-cover"
                  />
                ) : (
                  <User className="w-2.5 h-2.5 text-primary/70" />
                )}
              </div>
              <span className="text-[10px] font-medium tracking-tight text-foreground/70">
                {user?.firstName || "Me"} (Preview)
              </span>
            </div>
          </div>
        </div>

        <NodeHandle type="source" position={Position.Bottom} />
      </div>
    </div>
  );
});

PreviewInputNode.displayName = "PreviewInputNode";

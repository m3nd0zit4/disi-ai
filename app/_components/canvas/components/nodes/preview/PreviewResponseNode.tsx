import React, { memo } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { NodeHandle } from "../NodeHandle";
import { ResponseNodeData } from "../../../types";

export const PreviewResponseNode = memo(({ data, selected }: NodeProps) => {
  const responseData = data as unknown as ResponseNodeData;
  const { modelId } = responseData;

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
          <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary/70">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[12px] font-bold text-foreground/70 uppercase tracking-wider">
                {modelId || "AI Response"}
              </h3>
              <p className="text-[10px] text-muted-foreground/50 italic">
                Previewing response...
              </p>
            </div>
          </div>
        </div>

        <NodeHandle type="source" position={Position.Bottom} />
      </div>
    </div>
  );
});

PreviewResponseNode.displayName = "PreviewResponseNode";

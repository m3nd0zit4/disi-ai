"use client";

import { NodeToolbar as RTNodeToolbar, Position } from "@xyflow/react";
import { 
  RotateCcw, 
  Plus, 
  Copy, 
  Maximize2, 
  Trash2, 
  Check
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useDialog } from "@/hooks/useDialog";
import { useConnections } from "../../providers/ConnectionsProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NodeData {
  text?: string;
  userInput?: string;
  color?: string;
  [key: string]: unknown; // for extensibility
}

interface NodeToolbarProps {
  nodeId: string;
  isVisible?: boolean;
  data: NodeData;
}

const COLORS = [
  { name: "default", value: "transparent", border: "rgba(128,128,128,0.2)" },
  { name: "blue", value: "rgba(59, 130, 246, 0.15)", border: "#3b82f6" },
  { name: "purple", value: "rgba(168, 85, 247, 0.15)", border: "#a855f7" },
  { name: "pink", value: "rgba(236, 72, 153, 0.15)", border: "#ec4899" },
  { name: "yellow", value: "rgba(234, 179, 8, 0.15)", border: "#eab308" },
];

export const NodeToolbar = ({ nodeId, isVisible, data, showRegenerate }: NodeToolbarProps & { showRegenerate?: boolean }) => {
  const updateNodeData = useCanvasStore(state => state.updateNodeData);
  const duplicateNode = useCanvasStore(state => state.duplicateNode);
  const { deleteNode, regenerateNode } = useConnections();
  const { showDialog } = useDialog();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    const text = data.text || data.userInput || "";
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    showDialog({
      title: "Delete Node",
      description: "Are you sure you want to delete this node? This action cannot be undone.",
      type: "warning",
      onConfirm: () => {
        deleteNode(nodeId);
      }
    });
  };

  const handleReturn = async () => {
    try {
      await regenerateNode(nodeId);
    } catch (error) {
      console.error("Failed to regenerate node:", error);
      showDialog({
        title: "Regeneration Failed",
        description: "An error occurred while trying to regenerate the node. Please try again.",
        type: "error"
      });
    }
  };

  const handleColorChange = (color: string) => {
    updateNodeData(nodeId, { color });
  };

  return (
    <TooltipProvider>
      <RTNodeToolbar 
        isVisible={isVisible} 
        position={Position.Top}
        className="flex items-center gap-1 p-1 bg-background/60 backdrop-blur-2xl border border-primary/5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] mb-3 animate-in fade-in duration-300"
      >
        <div className="flex items-center gap-1 px-1.5 border-r border-primary/5 mr-1">
          {COLORS.map((c) => (
            <Tooltip key={c.name}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleColorChange(c.value)}
                  className={cn(
                    "size-4 rounded-full border transition-all hover:scale-110 active:scale-95 flex items-center justify-center",
                    data.color === c.value ? "border-foreground/40" : "border-transparent"
                  )}
                  style={{ 
                    backgroundColor: c.value === "transparent" ? "rgba(128,128,128,0.08)" : c.value,
                    borderColor: data.color === c.value ? undefined : "transparent"
                  }}
                >
                  {data.color === c.value && <div className="size-1 rounded-full bg-foreground/60" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] py-1 px-2">
                {c.name.charAt(0).toUpperCase() + c.name.slice(1)}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="flex items-center gap-0.5 pr-1">
          {showRegenerate && (
            <ToolbarButton 
              icon={<RotateCcw size={13} />} 
              tooltip="Regenerate" 
              onClick={handleReturn} 
            />
          )}
          <ToolbarButton 
            icon={<Plus size={13} />} 
            tooltip="Duplicate" 
            onClick={() => duplicateNode(nodeId)} 
          />
          <ToolbarButton 
            icon={isCopied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />} 
            tooltip={isCopied ? "Copied!" : "Copy Content"} 
            onClick={handleCopy} 
          />
          <ToolbarButton 
            icon={<Maximize2 size={13} />} 
            tooltip="View and Edit" 
            onClick={() => {}} 
          />
          <ToolbarButton 
            icon={<Trash2 size={13} />} 
            tooltip="Delete" 
            onClick={handleDelete}
            className="hover:bg-destructive/10 hover:text-destructive" 
          />
        </div>
      </RTNodeToolbar>
    </TooltipProvider>
  );
};

interface ToolbarButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

const ToolbarButton = ({ icon, tooltip, onClick, className }: ToolbarButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={cn(
          "p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
          className
        )}
      >
        {icon}
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="text-[10px] py-1 px-2">
      {tooltip}
    </TooltipContent>
  </Tooltip>
);

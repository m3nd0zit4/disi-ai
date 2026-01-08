"use client";

import { Button } from "@/components/ui/button";
import { 
  PanelLeft, 
  MessageSquare, 
  Plus, 
  Search 
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { Node } from "@xyflow/react";

export function CanvasToolbar() {
  const { toggleSidebar } = useSidebar();
  const { addNode, viewport, nodes, setNodes } = useCanvasStore();

  const handleAddFreeNode = () => {
    const newNodeId = `input-${Date.now()}`;
    
    // Calculate center of viewport
    // Default to (0,0) if viewport not available
    let position = { x: 0, y: 0 };
    if (viewport) {
      // viewport.x/y are the top-left corner in canvas coordinates (negative of screen offset)
      // zoom is the current zoom level
      // Center = (-viewport.x + window.innerWidth/2) / viewport.zoom
      // But since we don't have window.innerWidth easily here, let's use a simpler heuristic 
      // or just place it at a reasonable offset from the current view.
      position = {
        x: (-viewport.x + 400) / viewport.zoom,
        y: (-viewport.y + 300) / viewport.zoom,
      };
    }

    const newNode: Node = {
      id: newNodeId,
      type: "input",
      position,
      selected: true,
      data: {
        text: "",
        createdAt: Date.now(),
      },
    };

    // Deselect other nodes and add the new one
    const updatedNodes = nodes.map(n => ({ ...n, selected: false }));
    setNodes([...updatedNodes, newNode]);
  };

  return (
    <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-popover/80 backdrop-blur-xl border border-border shadow-2xl">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-xl text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="size-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-xl text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all"
        aria-label="Messages"
      >
        <MessageSquare className="size-4" />
      </Button>
 
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-xl text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all"
        aria-label="Add new"
        onClick={handleAddFreeNode}
      >
        <Plus className="size-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-xl text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all"
        aria-label="Search"
      >
        <Search className="size-4" />
      </Button>
    </div>
  );
}

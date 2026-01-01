"use client";

import { Button } from "@/components/ui/button";
import { 
  PanelLeft, 
  MessageSquare, 
  Plus, 
  Search 
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

export function CanvasToolbar() {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-[#1a1c1e]/80 backdrop-blur-xl border border-white/5 shadow-2xl">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
        onClick={toggleSidebar}
      >
        <PanelLeft className="size-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
      >
        <MessageSquare className="size-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
      >
        <Plus className="size-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
      >
        <Search className="size-4" />
      </Button>
    </div>
  );
}

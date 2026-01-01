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

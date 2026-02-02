"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  ChevronDown,
  Library
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Id } from "@/convex/_generated/dataModel";

interface KBSelectorProps {
  selectedKbIds: Id<"knowledgeBases">[];
  onSelect: (kbIds: Id<"knowledgeBases">[]) => void;
}

export function KBSelector({ selectedKbIds, onSelect }: KBSelectorProps) {
  const kbs = useQuery(api.knowledge_garden.knowledgeBases.list) || [];
  const allSelected = kbs.length > 0 && selectedKbIds.length === kbs.length;

  const toggleKb = (kbId: Id<"knowledgeBases">) => {
    if (selectedKbIds.includes(kbId)) {
      onSelect(selectedKbIds.filter((id) => id !== kbId));
    } else {
      onSelect([...selectedKbIds, kbId]);
    }
  };

  const toggleAll = () => {
    if (allSelected) {
      onSelect([]);
    } else {
      onSelect(kbs.map((kb) => kb._id));
    }
  };

  const getTriggerLabel = () => {
    if (allSelected) return "Using all knowledge bases";
    if (selectedKbIds.length === 0) return "Select knowledge base";
    if (selectedKbIds.length === 1) {
      const kb = kbs.find(k => k._id === selectedKbIds[0]);
      return kb ? kb.name : "1 selected";
    }
    return `${selectedKbIds.length} selected`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div 
          className={cn(
            "flex items-center gap-1.5 bg-muted/40 hover:bg-muted/60 px-2.5 py-1 rounded-full border border-primary/5 transition-all cursor-pointer group select-none h-7",
          )}
        >
          <Library className="w-3 h-3 text-muted-foreground/60 group-hover:text-primary/70 transition-colors" />
          <span className="text-[11px] font-medium text-muted-foreground/80 group-hover:text-primary transition-colors truncate max-w-[150px]">
            {getTriggerLabel()}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
        </div>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        side="top"
        sideOffset={8}
        align="start" 
        className="w-[220px] bg-card/98 backdrop-blur-xl border-primary/5 rounded-xl shadow-xl p-1 z-[100]"
      >
        {/* Select All / Deselect All */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            toggleAll();
          }}
          className="flex items-center gap-2.5 px-2 py-2 text-[11px] rounded-lg cursor-pointer hover:bg-primary/5 transition-colors"
        >
          <Checkbox 
            checked={allSelected} 
            className="h-3.5 w-3.5 rounded-[4px] border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <span className="font-semibold">
            {allSelected ? "Deselect All" : "Select All"}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-primary/5 my-1" /> 

        {/* KB List */}
        {kbs.map((kb) => (
          <DropdownMenuItem
            key={kb._id}
            onSelect={(e) => {
              e.preventDefault();
              toggleKb(kb._id);
            }}
            className="flex items-center gap-2.5 px-2 py-2 text-[11px] rounded-lg cursor-pointer hover:bg-primary/5 transition-colors"
          >
            <Checkbox 
              checked={selectedKbIds.includes(kb._id)} 
              className="h-3.5 w-3.5 rounded-[4px] border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="truncate">{kb.name}</span>
          </DropdownMenuItem>
        ))}

        {kbs.length === 0 && (
          <div className="px-2 py-4 text-center text-[10px] text-muted-foreground italic">
            No knowledge bases found
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

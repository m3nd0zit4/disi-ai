import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, ChevronsUpDown, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";

interface KBSelectorProps {
  selectedKbIds: Id<"knowledgeBases">[];
  onSelect: (kbIds: Id<"knowledgeBases">[]) => void;
}

export function KBSelector({ selectedKbIds, onSelect }: KBSelectorProps) {
  const [open, setOpen] = useState(false);
  const kbs = useQuery(api.knowledge_garden.knowledgeBases.list) || [];

  const toggleKb = (kbId: Id<"knowledgeBases">) => {
    if (selectedKbIds.includes(kbId)) {
      onSelect(selectedKbIds.filter((id) => id !== kbId));
    } else {
      onSelect([...selectedKbIds, kbId]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between text-xs h-8"
        >
          <div className="flex items-center gap-2 truncate">
            <Database className="h-3 w-3 shrink-0 opacity-50" />
            {selectedKbIds.length === 0
              ? "Select Knowledge Base..."
              : `${selectedKbIds.length} selected`}
          </div>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search KB..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No KB found.</CommandEmpty>
            <CommandGroup>
              {kbs.map((kb) => (
                <CommandItem
                  key={kb._id}
                  value={kb.title}
                  onSelect={() => toggleKb(kb._id)}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      selectedKbIds.includes(kb._id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {kb.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

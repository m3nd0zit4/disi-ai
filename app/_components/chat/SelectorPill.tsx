"use client";

import * as React from "react";
import { ChevronDown, Check, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SelectorPillProps<T extends string | number> {
  value: T;
  options: T[] | undefined;
  onSelect: (val: T) => void;
  label?: string;
  icon?: LucideIcon;
  formatValue?: (val: T) => string;
  className?: string;
}

export function SelectorPill<T extends string | number>({
  value,
  options,
  onSelect,
  label,
  icon: Icon,
  formatValue = (val) => String(val),
  className,
}: SelectorPillProps<T>) {
  if (!options || options.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div 
          className={cn(
            "flex items-center gap-1.5 bg-muted/40 hover:bg-muted/60 px-2.5 py-1 rounded-full border border-primary/5 transition-all cursor-pointer group select-none",
            className
          )}
        >
          {Icon && <Icon className="w-3 h-3 text-muted-foreground/60 group-hover:text-primary/70 transition-colors" />}
          <span className="text-[11px] font-medium text-muted-foreground/80 group-hover:text-primary transition-colors">
            {formatValue(value)}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        side="top"
        sideOffset={8}
        align="start" 
        className="min-w-[120px] bg-card/98 backdrop-blur-xl border-primary/5 rounded-xl shadow-xl p-1 z-[100]"
      >
        {label && (
          <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">
            {label}
          </div>
        )}
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onClick={() => onSelect(opt)}
            className={cn(
              "flex items-center justify-between px-2 py-1.5 text-[11px] rounded-lg cursor-pointer transition-colors",
              value === opt ? "bg-primary/10 text-primary font-medium" : "hover:bg-primary/5"
            )}
          >
            <span className="capitalize">{formatValue(opt)}</span>
            {value === opt && <Check className="w-3 h-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

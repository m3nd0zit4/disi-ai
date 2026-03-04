"use client";

import { TextShimmer } from "@/components/ui/text-shimmer";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ThinkingBarProps = {
  className?: string;
  text?: string;
  onStop?: () => void;
  stopLabel?: string;
  onClick?: () => void;
};

export function ThinkingBar({
  className,
  text = "Thinking",
  onStop,
  stopLabel = "Answer now",
  onClick,
}: ThinkingBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2",
        className
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <TextShimmer className="text-sm font-medium">{text}</TextShimmer>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <TextShimmer className="min-w-0 flex-1 text-sm font-medium">
          {text}
        </TextShimmer>
      )}
      {onStop ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={onStop}
        >
          {stopLabel}
        </Button>
      ) : null}
    </div>
  );
}

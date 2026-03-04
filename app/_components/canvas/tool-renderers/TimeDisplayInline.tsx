"use client";

import type { TimeDisplayOutput } from "@/lib/agent/tool-schemas";

export interface TimeDisplayInlineProps extends TimeDisplayOutput {}

export function TimeDisplayInline({ time, date, timezone }: TimeDisplayInlineProps) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-card-foreground shadow-sm">
      <span className="font-medium">{time ?? date ?? "—"}</span>
      {timezone && timezone !== "UTC" && (
        <span className="text-muted-foreground text-xs"> ({String(timezone)})</span>
      )}
    </div>
  );
}

"use client";

import type { TextStatsOutput } from "@/lib/agent/tool-schemas";

export interface TextStatsCardProps extends TextStatsOutput {}

export function TextStatsCard({ length, wordCount, lineCount }: TextStatsCardProps) {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <span><strong className="text-foreground/90">{length}</strong> caracteres</span>
      <span><strong className="text-foreground/90">{wordCount}</strong> palabras</span>
      <span><strong className="text-foreground/90">{lineCount}</strong> líneas</span>
    </div>
  );
}

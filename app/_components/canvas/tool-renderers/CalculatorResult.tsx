"use client";

import type { CalculatorResultOutput } from "@/lib/agent/tool-schemas";

export interface CalculatorResultProps extends CalculatorResultOutput {}

export function CalculatorResult({ result, expression }: CalculatorResultProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-x-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-sm">
      <span className="font-medium tabular-nums">{result}</span>
      {expression != null && (
        <span className="text-muted-foreground text-xs">({expression})</span>
      )}
    </div>
  );
}

"use client";

import type { SearchResultsOutput } from "@/lib/agent/tool-schemas";

export interface SearchResultsCardProps {
  results: SearchResultsOutput["results"];
  query?: string;
}

export function SearchResultsCard({ results, query }: SearchResultsCardProps) {
  const list = results ?? [];
  return (
    <div className="space-y-2">
      <span className="text-muted-foreground text-xs">
        {list.length} fuentes encontradas
      </span>
      {query && (
        <div className="bg-muted/30 rounded border p-2 text-sm italic">
          &ldquo;{query}&rdquo;
        </div>
      )}
      <div className="space-y-1.5 max-h-60 overflow-auto">
        {list.map((result, idx) => (
          <a
            key={result.url ?? `result-${idx}`}
            href={result.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded border p-2 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start gap-2">
              {result.favicon && (
                <img
                  src={result.favicon}
                  alt={result.domain ?? ""}
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary hover:underline line-clamp-1">
                  {result.title ?? result.url}
                </div>
                <div className="text-xs text-muted-foreground">
                  {result.domain}
                </div>
                {result.snippet && (
                  <div className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                    {result.snippet}
                  </div>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

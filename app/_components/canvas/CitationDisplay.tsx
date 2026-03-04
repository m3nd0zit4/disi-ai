"use client";

import { CitationList } from "@/components/tool-ui/citation";
import { safeParseSerializableCitation } from "@/components/tool-ui/citation/schema";
import type { Citation } from "./types";

const GOOGLE_FAVICON = "https://www.google.com/s2/favicons?domain=";

function domainFromHref(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "") || "";
  } catch {
    return "";
  }
}

/** Never use a URL as title; prefer domain or a short label. */
function normalizeTitle(c: Citation, href: string): string {
  const raw = (c.title ?? c.domain ?? "").trim();
  if (raw && !/^https?:\/\//i.test(raw)) return raw;
  const domain = (c.domain ?? domainFromHref(href)).trim();
  return domain || "Fuente";
}

function faviconOrFallback(c: Citation, domain: string): string | undefined {
  const v = c.favicon?.trim();
  if (v && /^https?:\/\//i.test(v)) return v;
  if (domain) return `${GOOGLE_FAVICON}${encodeURIComponent(domain)}&sz=32`;
  return undefined;
}

interface CitationDisplayProps {
  citations: Citation[];
}

/**
 * Sources block using Tool UI Citation (CitationList).
 * - Many sources → variant "stacked" (compact favicons + popover).
 * - Few sources → variant "default" (one card per citation).
 * @see https://www.tool-ui.com/docs/citation
 */
export function CitationDisplay({ citations }: CitationDisplayProps) {
  if (!citations || citations.length === 0) return null;

  const toolUiCitations = citations
    .map((c, i) => {
      const href = (c.url ?? "").trim();
      if (!href || !/^https?:\/\//i.test(href)) return null;
      const domain = (c.domain ?? domainFromHref(href)).trim();
      return safeParseSerializableCitation({
        id: `sources-cite-${i}-${domain || href.slice(0, 30)}`,
        href,
        title: normalizeTitle(c, href),
        snippet: c.description?.trim(),
        domain: domain || undefined,
        favicon: faviconOrFallback(c, domain),
      });
    })
    .filter((c): c is NonNullable<typeof c> => c != null);

  if (toolUiCitations.length === 0) return null;

  const variant = toolUiCitations.length > 6 ? "stacked" : "default";

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <h4 className="text-xs font-semibold text-muted-foreground/80 mb-2 uppercase tracking-wider">
        Fuentes ({toolUiCitations.length})
      </h4>
      <CitationList
        id="response-sources"
        citations={toolUiCitations}
        variant={variant}
      />
    </div>
  );
}

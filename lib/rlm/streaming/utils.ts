/**
 * Shared utilities for building StreamCitation.
 */

import type { StreamCitation } from "./types";

const FAVICON_BASE = "https://www.google.com/s2/favicons?sz=32&domain_url=";

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url.split("/").pop() || url;
  }
}

export function toStreamCitation(params: {
  url: string;
  title?: string;
  description?: string;
  snippet?: string;
  text?: string;
}): StreamCitation {
  const { url, title, description, snippet, text } = params;
  const domain = getDomain(url);
  return {
    url,
    title: title ?? domain,
    description: description ?? snippet ?? text ?? "",
    domain,
    favicon: `${FAVICON_BASE}${encodeURIComponent(url)}`,
  };
}

export function toStreamCitations<T>(
  items: T[],
  map: (item: T) => { url: string; title?: string; description?: string; snippet?: string; text?: string }
): StreamCitation[] {
  return items.map((item) => toStreamCitation(map(item)));
}

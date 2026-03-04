"use client";

/**
 * Tool UI toolkit (schema-first, backend tools only).
 * - Schema-first: each renderer safeParse(result) then renders component or null.
 * - Backend tools only: model returns result on server; we only render (no execute, no addResult).
 * - Existing runtime: Convex + canvas (no assistant-ui). Registry: tool name → render.
 *
 * Official reference (concepts, display, artifacts, media): docs/TOOL_UI_REFERENCE.md
 * @see https://www.tool-ui.com/docs/overview
 */

import React from "react";
import type { ToolPart } from "@/components/ui/tool";
import {
  safeParseSearchResults,
  safeParseTimeDisplay,
  safeParseCalculatorResult,
  safeParseTextStats,
} from "@/lib/agent/tool-schemas";
import { CitationList } from "@/components/tool-ui/citation";
import type { SerializableCitation } from "@/components/tool-ui/citation/schema";
import { safeParseSerializableCitation } from "@/components/tool-ui/citation/schema";
import { LinkPreview } from "@/components/tool-ui/link-preview";
import { safeParseSerializableLinkPreview } from "@/components/tool-ui/link-preview/schema";
import { Terminal } from "@/components/tool-ui/terminal";
import { safeParseSerializableTerminal } from "@/components/tool-ui/terminal/schema";
import { Chart } from "@/components/tool-ui/chart";
import { safeParseSerializableChart } from "@/components/tool-ui/chart/schema";
import { CodeBlock } from "@/components/tool-ui/code-block";
import { safeParseSerializableCodeBlock } from "@/components/tool-ui/code-block/schema";
import { CodeDiff } from "@/components/tool-ui/code-diff";
import { safeParseSerializableCodeDiff } from "@/components/tool-ui/code-diff/schema";
import { DataTable } from "@/components/tool-ui/data-table";
import { safeParseSerializableDataTable } from "@/components/tool-ui/data-table/schema";
import { MessageDraft } from "@/components/tool-ui/message-draft";
import { safeParseSerializableMessageDraft } from "@/components/tool-ui/message-draft/schema";
import { InstagramPost } from "@/components/tool-ui/instagram-post";
import { safeParseSerializableInstagramPost } from "@/components/tool-ui/instagram-post/schema";
import { LinkedInPost } from "@/components/tool-ui/linkedin-post";
import { safeParseSerializableLinkedInPost } from "@/components/tool-ui/linkedin-post/schema";
import { XPost } from "@/components/tool-ui/x-post";
import { safeParseSerializableXPost } from "@/components/tool-ui/x-post/schema";
import { Image } from "@/components/tool-ui/image";
import { safeParseSerializableImage } from "@/components/tool-ui/image/schema";
import { ImageGallery } from "@/components/tool-ui/image-gallery";
import { safeParseSerializableImageGallery } from "@/components/tool-ui/image-gallery/schema";
import { Video } from "@/components/tool-ui/video";
import { safeParseSerializableVideo } from "@/components/tool-ui/video/schema";
import { GeoMap } from "@/components/tool-ui/geo-map";
import { safeParseSerializableGeoMap } from "@/components/tool-ui/geo-map/schema";
import { WeatherWidget } from "@/components/tool-ui/weather-widget";
import { safeParseSerializableWeatherWidget } from "@/components/tool-ui/weather-widget/schema";
import { TimeDisplayInline } from "./TimeDisplayInline";
import { CalculatorResult as CalculatorResultComponent } from "./CalculatorResult";
import { TextStatsCard } from "./TextStatsCard";

export type ToolRenderer = (toolPart: ToolPart) => React.ReactNode | null;

/** Registry: tool name or uiType → render(toolPart). Keys match backend tool names / UI_BLOCK_TYPES. */
const registry: Record<string, ToolRenderer> = {};

// ---------------------------------------------------------------------------
// Search results (web_search, google_search, enterprise_web_search, search_results)
// Use Tool UI CitationList: map each result to Citation schema and render.
// ---------------------------------------------------------------------------

const GOOGLE_FAVICON = "https://www.google.com/s2/favicons?domain=";

function domainFromHref(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "") || "";
  } catch {
    return "";
  }
}

/** Only pass favicon if valid URL; else use Google favicon by domain. */
function faviconForCitation(value: string | undefined, domain: string): string | undefined {
  const v = value?.trim();
  if (v && /^https?:\/\//i.test(v)) return v;
  if (domain) return `${GOOGLE_FAVICON}${encodeURIComponent(domain)}&sz=32`;
  return undefined;
}

/** Never use a raw URL as title; use domain or short label. */
function titleForCitation(
  r: { title?: string; domain?: string },
  href: string
): string {
  const raw = (r.title ?? r.domain ?? "").trim();
  if (raw && !/^https?:\/\//i.test(raw)) return raw;
  const domain = (r.domain ?? domainFromHref(href)).trim();
  return domain || "Fuente";
}

/** Build Tool UI citations from array of items with url/title/snippet/domain/favicon. */
function buildCitationsFromItems(
  items: Array<{ url?: string; href?: string; title?: string; snippet?: string; description?: string; domain?: string; favicon?: string }>,
  listId: string
): SerializableCitation[] {
  const citations: SerializableCitation[] = [];
  for (let i = 0; i < items.length; i++) {
    const r = items[i];
    const href = (r.url ?? r.href ?? "").trim();
    if (!href || !/^https?:\/\//i.test(href)) continue;
    const domain = (r.domain ?? domainFromHref(href)).trim();
    const citation = safeParseSerializableCitation({
      id: `cite-${listId}-${i}`,
      href,
      title: titleForCitation(r, href),
      snippet: (r.snippet ?? r.description)?.trim(),
      domain: domain || undefined,
      favicon: faviconForCitation(r.favicon, domain),
    });
    if (citation) citations.push(citation);
  }
  return citations;
}

function renderSearchResults(toolPart: ToolPart): React.ReactNode | null {
  const payload = {
    query: toolPart.input?.query as string | undefined,
    results: toolPart.output?.results ?? toolPart.output?.sources,
    resultsCount: (toolPart.output?.resultsCount as number) ?? (Array.isArray(toolPart.output?.results) ? toolPart.output.results.length : 0),
  };
  const parsed = safeParseSearchResults(payload);
  if (!parsed || !parsed.results?.length) return null;
  const listId = `search-${toolPart.toolCallId ?? "results"}`;
  const citations = buildCitationsFromItems(parsed.results, listId);
  if (citations.length === 0) return null;
  return (
    <div className="space-y-2">
      {parsed.query && (
        <div className="text-muted-foreground rounded border bg-muted/30 p-2 text-sm italic">
          &ldquo;{parsed.query}&rdquo;
        </div>
      )}
      <CitationList id={listId} citations={citations} variant="stacked" />
    </div>
  );
}

registry["web_search"] = renderSearchResults;
registry["google_search"] = renderSearchResults;
registry["enterprise_web_search"] = renderSearchResults;
registry["search_results"] = renderSearchResults;

// ---------------------------------------------------------------------------
// Time display (get_current_time, time_display)
// ---------------------------------------------------------------------------

function renderTimeDisplay(toolPart: ToolPart): React.ReactNode | null {
  let parsed = safeParseTimeDisplay(toolPart.output);
  if (!parsed) {
    // Backend may send a single string or { value: string }
    const o = toolPart.output;
    if (o && typeof o === "object" && "value" in o && typeof (o as { value: unknown }).value === "string") {
      parsed = { time: (o as { value: string }).value };
    } else if (typeof o === "string") {
      parsed = { time: o };
    }
  }
  if (!parsed || (parsed.time == null && parsed.date == null && parsed.timezone == null)) return null;
  return <TimeDisplayInline {...parsed} />;
}

registry["get_current_time"] = renderTimeDisplay;
registry["time_display"] = renderTimeDisplay;

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

function renderCalculator(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseCalculatorResult(toolPart.output);
  if (!parsed) return null;
  return <CalculatorResultComponent {...parsed} />;
}

registry["calculator"] = renderCalculator;

// ---------------------------------------------------------------------------
// Text stats
// ---------------------------------------------------------------------------

function renderTextStats(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseTextStats(toolPart.output);
  if (!parsed) return null;
  return <TextStatsCard {...parsed} />;
}

registry["text_stats"] = renderTextStats;

// ---------------------------------------------------------------------------
// Generic "tool" with URL/href: try LinkPreview → Citation → fallback card
// ---------------------------------------------------------------------------

function renderToolWithLink(toolPart: ToolPart): React.ReactNode | null {
  if (toolPart.type !== "tool") return null;
  const o = toolPart.output;
  if (o == null || typeof o !== "object" || Array.isArray(o)) return null;
  // If output looks like time data, show time card (backend sometimes sends as generic "tool")
  const timeContent = renderTimeDisplay({ ...toolPart, output: o });
  if (timeContent) return timeContent;
  const href = (o.url ?? o.href) as string | undefined;
  if (!href || typeof href !== "string" || href.trim() === "") return null;
  const linkPreview = safeParseSerializableLinkPreview({ ...o, href: o.href ?? o.url });
  if (linkPreview) return <LinkPreview {...linkPreview} />;
  const domain = ((o.domain as string) ?? domainFromHref(href)).trim();
  const citation = safeParseSerializableCitation({
    id: (o.id as string) ?? `link-${toolPart.toolCallId ?? "tool"}`,
    href,
    title: titleForCitation({ title: o.title as string, domain: o.domain as string }, href),
    snippet: (o.snippet as string)?.trim(),
    domain: domain || undefined,
    favicon: faviconForCitation(o.favicon as string, domain),
  });
  if (citation) return <CitationList id={`tool-cite-${toolPart.toolCallId ?? "link"}`} citations={[citation]} variant="default" />;
  const fallbackTitle = titleForCitation({ title: o.title as string, domain: o.domain as string }, href);
  const snippet = (o.snippet as string)?.trim();
  return (
    <div className="rounded-md border bg-card p-3 text-card-foreground shadow-sm">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline underline-offset-4 hover:no-underline"
      >
        {fallbackTitle}
      </a>
      {domain && (
        <div className="text-muted-foreground mt-0.5 text-xs">{domain}</div>
      )}
      {snippet && (
        <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm">{snippet}</p>
      )}
    </div>
  );
}

registry["tool"] = renderToolWithLink;

// ---------------------------------------------------------------------------
// Terminal (terminal, or output matching schema)
// ---------------------------------------------------------------------------

function renderTerminal(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableTerminal(toolPart.output);
  if (!parsed) return null;
  return <Terminal {...parsed} />;
}

registry["terminal"] = renderTerminal;

// ---------------------------------------------------------------------------
// Artifacts & Media (Fase 3)
// ---------------------------------------------------------------------------

function renderChart(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableChart(toolPart.output);
  if (!parsed) return null;
  return <Chart {...parsed} />;
}
registry["chart"] = renderChart;

function renderCodeBlock(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableCodeBlock(toolPart.output);
  if (!parsed) return null;
  return <CodeBlock {...parsed} />;
}
registry["code_block"] = renderCodeBlock;
registry["code-block"] = renderCodeBlock;

function renderCodeDiff(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableCodeDiff(toolPart.output);
  if (!parsed) return null;
  return <CodeDiff {...parsed} />;
}
registry["code_diff"] = renderCodeDiff;
registry["code-diff"] = renderCodeDiff;

function renderDataTable(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableDataTable(toolPart.output);
  if (!parsed) return null;
  return <DataTable {...parsed} />;
}
registry["data_table"] = renderDataTable;
registry["data-table"] = renderDataTable;

function renderMessageDraft(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableMessageDraft(toolPart.output);
  if (!parsed) return null;
  return <MessageDraft {...parsed} />;
}
registry["message_draft"] = renderMessageDraft;
registry["message-draft"] = renderMessageDraft;

function renderInstagramPost(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableInstagramPost(toolPart.output);
  if (!parsed) return null;
  return <InstagramPost {...parsed} />;
}
registry["instagram_post"] = renderInstagramPost;
registry["instagram-post"] = renderInstagramPost;

function renderLinkedInPost(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableLinkedInPost(toolPart.output);
  if (!parsed) return null;
  return <LinkedInPost {...parsed} />;
}
registry["linkedin_post"] = renderLinkedInPost;
registry["linkedin-post"] = renderLinkedInPost;

function renderXPost(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableXPost(toolPart.output);
  if (!parsed) return null;
  return <XPost {...parsed} />;
}
registry["x_post"] = renderXPost;
registry["x-post"] = renderXPost;

function renderImage(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableImage(toolPart.output);
  if (!parsed) return null;
  return <Image {...parsed} />;
}
registry["image"] = renderImage;

function renderImageGallery(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableImageGallery(toolPart.output);
  if (!parsed) return null;
  return <ImageGallery {...parsed} />;
}
registry["image_gallery"] = renderImageGallery;
registry["image-gallery"] = renderImageGallery;

function renderVideo(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableVideo(toolPart.output);
  if (!parsed) return null;
  return <Video {...parsed} />;
}
registry["video"] = renderVideo;

// ---------------------------------------------------------------------------
// Display: Geo Map, Item Carousel, Weather Widget
// ---------------------------------------------------------------------------

/** Coerce backend output so GeoMap schema parses (e.g. lat/lng as numbers, id string). */
function normalizeGeoMapOutput(output: unknown): unknown {
  if (output == null || typeof output !== "object" || Array.isArray(output)) return output;
  const o = output as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : `geo-${Date.now()}`;
  const rawMarkers = Array.isArray(o.markers) ? o.markers : [];
  const markers = rawMarkers.map((m, i) => {
    if (m == null || typeof m !== "object") return null;
    const x = m as Record<string, unknown>;
    const lat = typeof x.lat === "number" ? x.lat : Number(x.lat);
    const lng = typeof x.lng === "number" ? x.lng : Number(x.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return {
      id: typeof x.id === "string" ? x.id : `m-${i}`,
      lat,
      lng,
      label: typeof x.label === "string" ? x.label : undefined,
      description: typeof x.description === "string" ? x.description : undefined,
    };
  }).filter((m): m is NonNullable<typeof m> => m != null);
  if (markers.length === 0) return output;
  return { id, title: o.title, description: o.description, markers, routes: o.routes };
}

function renderGeoMap(toolPart: ToolPart): React.ReactNode | null {
  const normalized = normalizeGeoMapOutput(toolPart.output);
  const parsed = safeParseSerializableGeoMap(normalized);
  if (!parsed) return null;
  return <GeoMap {...parsed} />;
}
registry["geo_map"] = renderGeoMap;
registry["geo-map"] = renderGeoMap;

function renderWeatherWidget(toolPart: ToolPart): React.ReactNode | null {
  const parsed = safeParseSerializableWeatherWidget(toolPart.output);
  if (!parsed) return null;
  return <WeatherWidget {...parsed} />;
}
registry["weather_widget"] = renderWeatherWidget;
registry["weather-widget"] = renderWeatherWidget;
registry["get_weather"] = renderWeatherWidget;

// ---------------------------------------------------------------------------
// Labels (Fase 4: centralize display names)
// ---------------------------------------------------------------------------

const TOOL_TYPE_LABELS: Record<string, string> = {
  web_search: "Búsqueda Web",
  google_search: "Búsqueda Web",
  enterprise_web_search: "Búsqueda Web",
  search_results: "Búsqueda Web",
  get_current_time: "Hora actual",
  time_display: "Hora actual",
  calculator: "Calculadora",
  text_stats: "Estadísticas de texto",
  tool: "Enlace",
  terminal: "Terminal",
  geo_map: "Mapa",
  "geo-map": "Mapa",
  weather_widget: "Clima",
  "weather-widget": "Clima",
  get_weather: "Clima",
  chart: "Gráfico",
  code_block: "Código",
  "code-block": "Código",
  code_diff: "Diff",
  "code-diff": "Diff",
  data_table: "Tabla",
  "data-table": "Tabla",
  message_draft: "Borrador",
  "message-draft": "Borrador",
  instagram_post: "Instagram",
  "instagram-post": "Instagram",
  linkedin_post: "LinkedIn",
  "linkedin-post": "LinkedIn",
  x_post: "X",
  "x-post": "X",
  image: "Imagen",
  image_gallery: "Galería",
  "image-gallery": "Galería",
  video: "Vídeo",
};

export function getToolLabel(type: string): string {
  return TOOL_TYPE_LABELS[type] ?? type;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getToolkitRenderer(key: string): ToolRenderer | undefined {
  return registry[key];
}

/**
 * Fallback: any tool output with results/sources array → Tool UI CitationList.
 * So every tool that returns "resources" uses the same Citation UI in one place.
 */
function renderCitationsFromOutput(toolPart: ToolPart): React.ReactNode | null {
  const o = toolPart.output;
  if (o == null || typeof o !== "object" || Array.isArray(o)) return null;
  const raw = (o.results ?? o.sources) as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items = raw.map((r) => ({
    url: typeof r.url === "string" ? r.url : typeof r.href === "string" ? r.href : undefined,
    title: typeof r.title === "string" ? r.title : undefined,
    snippet: typeof r.snippet === "string" ? r.snippet : typeof r.description === "string" ? r.description : undefined,
    domain: typeof r.domain === "string" ? r.domain : undefined,
    favicon: typeof r.favicon === "string" ? r.favicon : undefined,
  }));
  const listId = `citations-${toolPart.toolCallId ?? toolPart.type ?? "sources"}`;
  const citations = buildCitationsFromItems(items, listId);
  if (citations.length === 0) return null;
  return (
    <div className="space-y-2">
      <CitationList id={listId} citations={citations} variant="stacked" />
    </div>
  );
}

export function renderToolOutput(toolPart: ToolPart): React.ReactNode | null {
  const key = toolPart.type;
  const renderer = getToolkitRenderer(key);
  if (renderer) {
    const out = renderer(toolPart);
    if (out != null) return out;
  }
  // Fallback: backend may send time as generic "tool" or with different shape
  const timeContent = renderTimeDisplay(toolPart);
  if (timeContent) return timeContent;
  // Fallback: any tool that returns results/sources uses Tool UI CitationList
  const citationsContent = renderCitationsFromOutput(toolPart);
  if (citationsContent) return citationsContent;
  return null;
}

/**
 * Central registry of tools for the agent loop.
 * Tools can be custom (execute function), HTTP, or MCP (extensible via type).
 */

import { tool as aiTool, zodSchema } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";

const registry = new Map<string, ToolDefinition>();

/**
 * Register a tool by name. Overwrites if the name already exists.
 */
export function registerTool<INPUT = unknown, OUTPUT = unknown>(
  def: ToolDefinition<INPUT, OUTPUT>
): void {
  registry.set(def.name, def as ToolDefinition);
}

/**
 * Get a tool definition by name.
 */
export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

/**
 * Get all registered tool names.
 */
export function getRegisteredToolNames(): string[] {
  return Array.from(registry.keys());
}

/**
 * Resolve a list of tool names to AI SDK tool definitions for use with streamText/generateText.
 * All tools are executed automatically by the SDK when the model calls them (no human-in-the-loop).
 * See Vercel AI SDK: https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling
 */
export function getAISDKToolsForNames(toolNames: string[]): Record<string, ReturnType<typeof aiTool>> {
  const result: Record<string, ReturnType<typeof aiTool>> = {};
  for (const name of toolNames) {
    const def = registry.get(name);
    if (!def) continue;
    result[name] = aiTool({
      description: def.description,
      inputSchema: zodSchema(def.parameters),
      execute: async (input) => def.execute(input as Parameters<ToolDefinition["execute"]>[0]),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Built-in test / example tools
// ---------------------------------------------------------------------------

/** Tool: returns current server date and time (day of week, date, time). */
const getCurrentTimeTool: ToolDefinition<
  { timezone?: string },
  { time: string; date: string; dayOfWeek: string; timezone: string }
> = {
  name: "get_current_time",
  description:
    "Returns the current date and time on the server (day of week, full date, and time). Call this when the user asks for the current time, what day it is today, the current date, or the time in a specific timezone. Use for any question that requires knowing 'now' (e.g. 'qué hora es', 'what day is it', 'fecha actual'). Optional: pass an IANA timezone (e.g. America/New_York, Europe/Madrid) to get the time in that zone; otherwise returns UTC.",
  parameters: z.object({
    timezone: z
      .string()
      .optional()
      .describe("IANA timezone name (e.g. Europe/Madrid, America/New_York). Omit for UTC."),
  }),
  execute: async (args) => {
    const tz = args.timezone ?? "UTC";
    const now = new Date();
    const fullFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      dateStyle: "full",
      timeStyle: "long",
    });
    const dateFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      timeStyle: "long",
    });
    return {
      time: fullFormatter.format(now),
      date: dateFormatter.format(now),
      dayOfWeek: new Intl.DateTimeFormat("en-CA", { timeZone: tz, weekday: "long" }).format(now),
      timezone: tz,
    };
  },
  type: "custom",
};

registerTool(getCurrentTimeTool);

// ---------------------------------------------------------------------------
// Calculator (safe: numbers and basic operators only)
// ---------------------------------------------------------------------------

const SAFE_MATH_REGEX = /^[\d\s+\-*/().]+$/;

const calculatorTool: ToolDefinition<
  { expression: string },
  { result: number; expression: string }
> = {
  name: "calculator",
  description:
    "Evaluate a mathematical expression. Use when the user asks for a calculation, math, or arithmetic (e.g. 'cuánto es 15% de 200', '2^10', 'raíz de 144'). Pass a single expression with numbers and operators: + - * / ( ) and optionally ** for power. Only supports basic math; no variables or functions.",
  parameters: z.object({
    expression: z
      .string()
      .describe("The mathematical expression to evaluate (e.g. '2 + 3 * 4', '(100 * 0.15)', '2 ** 10')."),
  }),
  execute: async (args) => {
    const expr = args.expression.trim().replace(/\s+/g, " ");
    if (!SAFE_MATH_REGEX.test(expr)) {
      throw new Error("Invalid characters in expression. Only numbers and + - * / ( ) are allowed.");
    }
    try {
      const fn = new Function(`return (${expr})`);
      const result = fn();
      if (typeof result !== "number" || !Number.isFinite(result)) {
        throw new Error("Result is not a finite number.");
      }
      return { result, expression: expr };
    } catch (e) {
      throw new Error(`Cannot evaluate: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
  type: "custom",
};

registerTool(calculatorTool);

// ---------------------------------------------------------------------------
// Text / string utilities (e.g. character or word count)
// ---------------------------------------------------------------------------

const textStatsTool: ToolDefinition<
  { text: string },
  { length: number; wordCount: number; lineCount: number }
> = {
  name: "text_stats",
  description:
    "Get character count, word count, and line count of a text. Use when the user asks how many words, characters, or lines a text has, or to analyze a snippet they provide.",
  parameters: z.object({
    text: z.string().describe("The text to analyze."),
  }),
  execute: async (args) => {
    const text = args.text ?? "";
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lineCount = text ? text.split(/\n/).length : 0;
    return {
      length: text.length,
      wordCount,
      lineCount,
    };
  },
  type: "custom",
};

registerTool(textStatsTool);

// ---------------------------------------------------------------------------
// Tool UI: get_weather (Weather Widget)
// ---------------------------------------------------------------------------

type WeatherToolOutput = {
  id: string;
  location: { name: string };
  units: { temperature: "celsius" | "fahrenheit" };
  current: {
    temperature: number;
    tempMin: number;
    tempMax: number;
    conditionCode: string;
  };
  forecast: Array<{ label: string; tempMin: number; tempMax: number; conditionCode: string }>;
  time?: { localTimeOfDay?: number };
  updatedAt?: string;
};

function getWeatherMock(locationName: string, temperatureUnit: "celsius" | "fahrenheit"): WeatherToolOutput {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const localTimeOfDay = hour / 24;
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const forecast = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i + 1);
    return {
      label: i === 0 ? "Mañana" : days[d.getDay()],
      tempMin: 10 + i,
      tempMax: 18 + i,
      conditionCode: i % 3 === 0 ? "partly-cloudy" : "clear",
    };
  });
  return {
    id: `weather-${locationName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
    location: { name: locationName },
    units: { temperature: temperatureUnit },
    current: {
      temperature: 22,
      tempMin: 15,
      tempMax: 25,
      conditionCode: "partly-cloudy",
    },
    forecast,
    time: { localTimeOfDay },
    updatedAt: now.toISOString(),
  };
}

const getWeatherTool: ToolDefinition<
  { location: string; units?: "celsius" | "fahrenheit" },
  WeatherToolOutput
> = {
  name: "get_weather",
  description:
    "Get current weather and forecast for a location. Use when the user asks about weather, temperature, or forecast in a city or place (e.g. 'qué tiempo hace en Madrid', 'weather in Tokyo', 'pronóstico para Barcelona').",
  parameters: z.object({
    location: z.string().describe("City name or place (e.g. 'Madrid', 'New York', 'Tokyo')."),
    units: z.enum(["celsius", "fahrenheit"]).optional().describe("Temperature unit. Default celsius."),
  }),
  execute: async (args): Promise<WeatherToolOutput> => {
    const locationName = (args.location ?? "Unknown").trim() || "Unknown";
    const temperatureUnit = args.units ?? "celsius";
    try {
      const { fetchWeatherForLocation } = await import("@/lib/agent/adapters/weather");
      const payload = await fetchWeatherForLocation(locationName, temperatureUnit);
      return payload as WeatherToolOutput;
    } catch (_err) {
      return getWeatherMock(locationName, temperatureUnit);
    }
  },
  type: "custom",
};

registerTool(getWeatherTool);

// ---------------------------------------------------------------------------
// Tool UI: geo_map (Geo Map)
// ---------------------------------------------------------------------------

type GeoMapToolOutput = {
  id: string;
  title?: string;
  description?: string;
  markers: Array<{ id?: string; lat: number; lng: number; label?: string; description?: string }>;
  routes?: Array<{ id?: string; points: Array<{ lat: number; lng: number }>; label?: string; color?: string }>;
};

/** Known country/capital coords so map queries like "Colombia" or "capital" return a real marker. */
const COUNTRY_CAPITAL_MARKERS: Record<string, { lat: number; lng: number; label: string }> = {
  colombia: { lat: 4.711, lng: -74.0721, label: "Bogotá (Capital de Colombia)" },
  bogotá: { lat: 4.711, lng: -74.0721, label: "Bogotá" },
  bogota: { lat: 4.711, lng: -74.0721, label: "Bogotá" },
  madrid: { lat: 40.4168, lng: -3.7038, label: "Madrid" },
  barcelona: { lat: 41.3851, lng: 2.1734, label: "Barcelona" },
  mexico: { lat: 19.4326, lng: -99.1332, label: "Ciudad de México" },
  argentina: { lat: -34.6037, lng: -58.3816, label: "Buenos Aires" },
  peru: { lat: -12.0464, lng: -77.0428, label: "Lima" },
  chile: { lat: -33.4489, lng: -70.6693, label: "Santiago" },
  brasil: { lat: -15.7939, lng: -47.8828, label: "Brasilia" },
  brazil: { lat: -15.7939, lng: -47.8828, label: "Brasilia" },
};

const geoMapTool: ToolDefinition<
  { title?: string; query?: string; markers?: Array<{ lat: number; lng: number; label?: string }> },
  GeoMapToolOutput
> = {
  name: "geo_map",
  description:
    "Renders an interactive map with one or more location markers. Use whenever the user intent is to see where something is, get a place on a map, or visualize an address or geographic point. Invoke this tool in addition to any text answer so the UI shows the map; do not only describe the location in prose. Parameters: pass a place name or address in 'query', or provide 'markers' (lat/lng and optional label) when you have coordinates.",
  parameters: z.object({
    title: z.string().optional().describe("Short title for the map block."),
    query: z.string().optional().describe("Place name, city, or full address to display. Use when the user refers to a location by name or address and you are not passing precomputed markers."),
    markers: z
      .array(z.object({ lat: z.number(), lng: z.number(), label: z.string().optional() }))
      .optional()
      .describe("Explicit markers (latitude, longitude, optional label). Use when you have or compute coordinates."),
  }),
  execute: async (args): Promise<GeoMapToolOutput> => {
    const id = `geo-${Date.now()}`;
    let markers: GeoMapToolOutput["markers"];
    if (args.markers?.length) {
      markers = args.markers.map((m, i) => ({
        id: `m-${i}`,
        lat: m.lat,
        lng: m.lng,
        label: m.label,
      }));
    } else {
      const rawQuery = (args.query ?? "").trim();
      const q = rawQuery.toLowerCase().replace(/\s+/g, " ");
      const exact = q ? COUNTRY_CAPITAL_MARKERS[q] ?? COUNTRY_CAPITAL_MARKERS[q.replace(/\s+/g, "_")] : undefined;
      if (exact) {
        markers = [{ id: "m-0", lat: exact.lat, lng: exact.lng, label: exact.label }];
      } else {
        // Fallback: if query contains a known city/country name, use that location with the user's query as label
        let fallback = Object.entries(COUNTRY_CAPITAL_MARKERS).find(
          ([key]) => key.length >= 3 && q.includes(key),
        );
        if (fallback) {
          const [, coords] = fallback;
          markers = [{ id: "m-0", lat: coords.lat, lng: coords.lng, label: rawQuery || coords.label }];
        } else {
          markers = [
            { id: "m-0", lat: 40.4168, lng: -3.7038, label: rawQuery || "Madrid" },
            { id: "m-1", lat: 41.3851, lng: 2.1734, label: "Barcelona" },
          ];
        }
      }
    }
    return {
      id,
      title: args.title ?? "Mapa",
      description: args.query ? `Resultados para: ${args.query}` : undefined,
      markers,
    };
  },
  type: "custom",
};

registerTool(geoMapTool);

// ---------------------------------------------------------------------------
// Tool UI: chart (Chart – bar/line)
// ---------------------------------------------------------------------------
// When the model has actual numbers to show, it MUST pass "data" and "series"
// so the chart displays them; otherwise we show placeholder data.

function coerceToNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function inferXKey(firstRow: Record<string, unknown>, seriesKeys: string[]): string {
  const set = new Set(seriesKeys);
  for (const key of Object.keys(firstRow)) {
    if (!set.has(key)) return key;
  }
  return "period";
}

type ChartPlaceholderOutput = {
  id: string;
  type: "bar" | "line";
  title: string;
  description?: string;
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: Array<{ key: string; label: string; color?: string }>;
  showLegend: boolean;
  showGrid: boolean;
  colors?: string[];
};

function buildPlaceholderChart(
  id: string,
  topic: string,
  description?: string,
  chartType: "bar" | "line" = "bar"
): ChartPlaceholderOutput {
  const xKey = "period";
  const seriesKeys = ["value"];
  const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
  const data = labels.map((label) => {
    const row: Record<string, unknown> = { [xKey]: label };
    seriesKeys.forEach((key) => {
      row[key] = 3000 + Math.round(Math.random() * 2000);
    });
    return row;
  });
  const series = seriesKeys.map((key) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
  }));
  return {
    id,
    type: chartType,
    title: topic,
    description: description ?? `${labels.length} periodos`,
    data,
    xKey,
    series,
    showLegend: true,
    showGrid: true,
  };
}

type ChartToolOutput = {
  id: string;
  type: "bar" | "line";
  title?: string;
  description?: string;
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: Array<{ key: string; label: string; color?: string }>;
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
};

const chartSeriesSchema = z.object({
  key: z.string().min(1).describe("Field name in each data row that holds the Y value (must be numeric). Must exist in every object in 'data'."),
  label: z.string().min(1).describe("Display name in legend and tooltips (e.g. 'Ingresos (B USD)', 'Revenue')."),
  color: z.string().optional().describe("Optional color for this series (e.g. 'var(--chart-1)', '#3b82f6'). If omitted, palette is used."),
});

const chartTool: ToolDefinition<
  {
    topic: string;
    description?: string;
    type?: "bar" | "line";
    xKey?: string;
    seriesKeys?: string[];
    series?: Array<{ key: string; label: string; color?: string }>;
    data?: Array<Record<string, unknown>>;
    colors?: string[];
    showLegend?: boolean;
    showGrid?: boolean;
  },
  ChartToolOutput
> = {
  name: "chart",
  description:
    "Renders a bar or line chart. Pass 'data' and 'series' (and optionally 'xKey') when you have actual numbers; otherwise placeholder data is shown. type: 'bar' for categories/segments; 'line' for time-series trends. Chart is interactive (tooltips).",
  parameters: z.object({
    topic: z.string().describe("Short title for the chart (e.g. 'NVIDIA FY2026 - Ingresos por segmento', 'Revenue by quarter')."),
    description: z.string().optional().describe("Optional subtitle or unit (e.g. 'Ingresos en miles de millones USD', 'FY2026')."),
    type: z.enum(["bar", "line"]).optional().describe("'bar': categories or segments (e.g. segment, product, region). 'line': time-series or continuous data (e.g. month, quarter, year). Default: 'bar'."),
    xKey: z.string().optional().describe("Key in each data row used for the X axis. Must match a key in every object in 'data'. Examples: 'segment', 'segmento', 'category', 'month', 'quarter', 'year', 'time', 'period', 'date', 'region', 'product'. If omitted when passing 'data', inferred from first row."),
    series: z.array(chartSeriesSchema).optional().describe("Series to plot. Each item: key = numeric field in each row, label = legend text, color = optional. E.g. [{ key: 'value', label: 'Ingresos (B USD)' }]. REQUIRED when passing 'data' so the chart shows your numbers."),
    seriesKeys: z.array(z.string()).optional().describe("Alternative to 'series': just the keys (labels derived from key names). Ignored if 'series' is provided."),
    data: z.array(z.record(z.unknown())).optional().describe("Data rows. Each row: one key equal to xKey (string or number for X) and one key per series.key (number for Y). E.g. [{ segment: 'Data Center', value: 193.7 }, { segment: 'Gaming', value: 16 }]. Pass so the chart displays your numbers."),
    colors: z.array(z.string()).optional().describe("Optional color palette (array of CSS colors) applied to series in order. E.g. ['#3b82f6', '#10b981']."),
    showLegend: z.boolean().optional().describe("Whether to show the legend. Default true."),
    showGrid: z.boolean().optional().describe("Whether to show grid lines. Default true."),
  }),
  execute: async (args): Promise<ChartToolOutput> => {
    const topic = (args.topic ?? "").trim() || "Datos";
    const id = `chart-${topic.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const chartType = args.type === "line" ? "line" : "bar";
    const showLegend = args.showLegend ?? true;
    const showGrid = args.showGrid ?? true;

    const hasUserData = Array.isArray(args.data) && args.data.length > 0;
    const userSeries = args.series?.length ? args.series : undefined;

    if (hasUserData && userSeries?.length && args.data) {
      const userData = args.data;
      const xKey = (args.xKey ?? "").trim() || inferXKey(userData[0], userSeries.map((s) => s.key));
      const data: Array<Record<string, unknown>> = [];
      for (const row of userData) {
        const out: Record<string, unknown> = {};
        const xVal = row[xKey];
        out[xKey] = typeof xVal === "string" || typeof xVal === "number" ? xVal : String(xVal ?? "");
        for (const s of userSeries) {
          const num = coerceToNumber(row[s.key]);
          out[s.key] = num !== null ? num : 0;
        }
        data.push(out);
      }
      return {
        id,
        type: chartType,
        title: topic,
        description: args.description,
        data,
        xKey,
        series: userSeries.map((s) => ({ key: s.key, label: s.label, color: s.color })),
        colors: args.colors?.length ? args.colors : undefined,
        showLegend,
        showGrid,
      };
    }

    return { ...buildPlaceholderChart(id, topic, args.description, chartType), showLegend, showGrid } as ChartToolOutput;
  },
  type: "custom",
};

registerTool(chartTool);

// ---------------------------------------------------------------------------
// Tool UI: data_table (Data Table)
// ---------------------------------------------------------------------------

const dataTableColumnFormatSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text") }),
  z.object({
    kind: z.literal("number"),
    decimals: z.number().optional(),
    unit: z.string().optional(),
    compact: z.boolean().optional(),
    showSign: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("currency"),
    currency: z.string(),
    decimals: z.number().optional(),
  }),
  z.object({
    kind: z.literal("percent"),
    decimals: z.number().optional(),
    showSign: z.boolean().optional(),
    basis: z.enum(["fraction", "unit"]).optional(),
  }),
  z.object({
    kind: z.literal("date"),
    dateFormat: z.enum(["short", "long", "relative"]).optional(),
  }),
  z.object({
    kind: z.literal("delta"),
    decimals: z.number().optional(),
    upIsPositive: z.boolean().optional(),
    showSign: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("status"),
    statusMap: z.record(
      z.string(),
      z.object({
        tone: z.enum(["success", "warning", "danger", "info", "neutral"]),
        label: z.string().optional(),
      })
    ),
  }),
  z.object({
    kind: z.literal("boolean"),
    labels: z.object({ true: z.string(), false: z.string() }).optional(),
  }),
  z.object({
    kind: z.literal("link"),
    hrefKey: z.string().optional(),
    external: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("badge"),
    colorMap: z.record(z.string(), z.enum(["success", "warning", "danger", "info", "neutral"])).optional(),
  }),
  z.object({
    kind: z.literal("array"),
    maxVisible: z.number().optional(),
  }),
]);

const dataTableColumnSchema = z.object({
  key: z.string().describe("Field name in each row (must exist in every row object)."),
  label: z.string().describe("Column header text (e.g. 'Precio', 'Símbolo')."),
  abbr: z.string().optional().describe("Abbreviated label for narrow viewports."),
  sortable: z.boolean().optional().describe("Whether column is sortable. Default true."),
  align: z.enum(["left", "right", "center"]).optional().describe("Cell alignment: 'right' for numbers/prices, 'center' for badges/status, 'left' default."),
  width: z.string().optional().describe("Optional fixed width (CSS value e.g. '100px')."),
  truncate: z.boolean().optional().describe("Truncate long text with ellipsis."),
  priority: z.enum(["primary", "secondary", "tertiary"]).optional().describe("Mobile: primary = always visible, secondary = expandable, tertiary = hidden on small screens."),
  hideOnMobile: z.boolean().optional().describe("Hide this column on mobile."),
  format: dataTableColumnFormatSchema.optional().describe("How to display: number (decimals?, compact?, unit?) | currency (currency, decimals?) | percent (decimals?, basis 'unit'|'fraction') | date (dateFormat 'short'|'long'|'relative') | delta (decimals?, upIsPositive?) | status (statusMap: value→tone+label) | boolean (labels) | link (hrefKey?) | badge (colorMap?) | array (maxVisible?)."),
});

const defaultSortSchema = z.object({
  by: z.string().describe("Column key to sort by (must match a column key)."),
  direction: z.enum(["asc", "desc"]).describe("'asc' or 'desc'."),
});

type DataTableToolOutput = {
  id: string;
  columns: Array<{
    key: string;
    label: string;
    abbr?: string;
    sortable?: boolean;
    align?: "left" | "right" | "center";
    width?: string;
    truncate?: boolean;
    priority?: "primary" | "secondary" | "tertiary";
    hideOnMobile?: boolean;
    format?: z.infer<typeof dataTableColumnFormatSchema>;
  }>;
  data: Array<Record<string, string | number | boolean | null>>;
  rowIdKey?: string;
  defaultSort?: { by: string; direction: "asc" | "desc" };
  emptyMessage?: string;
};

const dataTableTool: ToolDefinition<
  {
    topic: string;
    columns?: Array<z.infer<typeof dataTableColumnSchema>>;
    rows?: Array<Record<string, string | number | boolean | null>>;
    rowIdKey?: string;
    defaultSort?: z.infer<typeof defaultSortSchema>;
    emptyMessage?: string;
  },
  DataTableToolOutput
> = {
  name: "data_table",
  description:
    "Renders a sortable table. Use for prices, market symbols, company data, or any tabular list. Pass 'columns' (with optional format, align, priority) and 'rows'. Each row must have keys matching column keys; include 'id' (or rowIdKey) for row identity. Supports format: currency, percent, date, delta, status, etc.",
  parameters: z.object({
    topic: z.string().describe("Short title for the table (e.g. 'Precios de acciones', 'Comparativa por segmento')."),
    columns: z.array(dataTableColumnSchema).optional().describe("Column definitions: key, label; optional abbr, align ('left'|'right'|'center'), sortable, priority ('primary'|'secondary'|'tertiary'), format (currency, percent, date, delta, status, etc.). If omitted, default symbol/price/change table is used."),
    rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))).optional().describe("Table rows. Each object must have a key for each column.key; include 'id' (or rowIdKey) for unique row identity."),
    rowIdKey: z.string().optional().describe("Key in each row that uniquely identifies the row (e.g. 'id', 'uuid'). Recommended for dynamic tables."),
    defaultSort: defaultSortSchema.optional().describe("Initial sort: by = column key, direction = 'asc' or 'desc'. E.g. { by: 'price', direction: 'desc' }."),
    emptyMessage: z.string().optional().describe("Message shown when there are no rows (e.g. 'No hay datos')."),
  }),
  execute: async (args): Promise<DataTableToolOutput> => {
    const topic = (args.topic ?? "").trim() || "Tabla";
    const id = `data-table-${topic.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const rowIdKey = args.rowIdKey ?? "id";

    const columns = args.columns?.length
      ? args.columns.map((c) => ({
          key: c.key,
          label: c.label,
          abbr: c.abbr,
          sortable: c.sortable,
          align: c.align,
          width: c.width,
          truncate: c.truncate,
          priority: c.priority,
          hideOnMobile: c.hideOnMobile,
          format: c.format,
        }))
      : [
          { key: "symbol", label: "Símbolo" },
          { key: "price", label: "Precio", format: { kind: "currency" as const, currency: "USD", decimals: 2 } },
          { key: "change", label: "Cambio %", format: { kind: "percent" as const, decimals: 2, basis: "unit" as const } },
        ];

    const defaultData: Array<Record<string, string | number>> = [
      { id: "1", symbol: "AAPL", price: 189.84, change: 2.1 },
      { id: "2", symbol: "MSFT", price: 378.91, change: -0.5 },
      { id: "3", symbol: "NVDA", price: 495.22, change: 5.2 },
      { id: "4", symbol: "GOOGL", price: 141.80, change: 1.3 },
    ];

    const data: Array<Record<string, string | number | boolean | null>> = args.rows?.length
      ? args.rows.map((row, i) => {
          const rowId = (row as Record<string, unknown>)[rowIdKey];
          const idVal = rowId != null ? String(rowId) : String(i + 1);
          return { ...row, [rowIdKey]: idVal } as Record<string, string | number | boolean | null>;
        })
      : (defaultData as Array<Record<string, string | number | boolean | null>>);

    return {
      id,
      columns,
      data,
      rowIdKey,
      defaultSort: args.defaultSort,
      emptyMessage: args.emptyMessage,
    };
  },
  type: "custom",
};

registerTool(dataTableTool);

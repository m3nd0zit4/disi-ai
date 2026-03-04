/**
 * Generative UI contract: backend emits typed uiType + props; client maps to React components.
 * Shared between processor (deriving uiType/uiProps from tool events) and frontend (rendering).
 */

/** Canonical UI block types for tool-derived blocks */
export const UI_BLOCK_TYPES = {
  SEARCH_RESULTS: "search_results",
  TIME_DISPLAY: "time_display",
  CONFIRM_BUTTONS: "confirm_buttons",
  /** Generic block for any tool without a specific mapping; keeps narrative driven by stream order */
  TOOL_STEP: "tool_step",
} as const;

export type UIBlockType = (typeof UI_BLOCK_TYPES)[keyof typeof UI_BLOCK_TYPES];

/** Props for search_results block */
export interface SearchResultsUIProps {
  query?: string;
  results?: Array<{ title?: string; url?: string; snippet?: string; domain?: string; favicon?: string }>;
  resultsCount?: number;
}

/** Props for time_display block (get_current_time: day, date, time, timezone) */
export interface TimeDisplayUIProps {
  time?: string;
  date?: string;
  dayOfWeek?: string;
  timezone?: string;
}

/** Props for confirm_buttons block (human-in-the-loop) */
export interface ConfirmButtonsUIProps {
  tool: string;
  args?: Record<string, unknown>;
  callId?: string;
}

/** Props for generic tool_step block (any tool) */
export interface ToolStepUIProps {
  tool: string;
  input?: Record<string, unknown>;
  steps?: string[];
}

export type UIBlockPropsMap = {
  [UI_BLOCK_TYPES.SEARCH_RESULTS]: SearchResultsUIProps;
  [UI_BLOCK_TYPES.TIME_DISPLAY]: TimeDisplayUIProps;
  [UI_BLOCK_TYPES.CONFIRM_BUTTONS]: ConfirmButtonsUIProps;
  [UI_BLOCK_TYPES.TOOL_STEP]: ToolStepUIProps;
};

export type UIBlockProps = SearchResultsUIProps | TimeDisplayUIProps | ConfirmButtonsUIProps | ToolStepUIProps;

/**
 * Derives uiType and uiProps from a tool event (tool name + input/output).
 * Used in StreamProcessor when emitting toolEvent so Convex and client get typed UI blocks.
 */
export function deriveUIFromToolEvent(ev: {
  tool: string;
  input?: Record<string, unknown>;
  output?: unknown;
  resultsCount?: number;
  steps?: string[];
}): { uiType: UIBlockType; uiProps: UIBlockProps } | null {
  const { tool, input, output, resultsCount, steps } = ev;
  const toolSlug = (tool ?? "").toLowerCase().replace(/-/g, "_");

  switch (toolSlug) {
    case "web_search":
    case "websearch":
    case "google_search":
    case "enterprise_web_search": {
      const query = input?.query ?? (typeof input?.query === "string" ? input.query : undefined);
      const results = Array.isArray(output) ? output : (output as { sources?: unknown[] })?.sources;
      return {
        uiType: UI_BLOCK_TYPES.SEARCH_RESULTS,
        uiProps: {
          query: typeof query === "string" ? query : undefined,
          results: Array.isArray(results) ? (results as SearchResultsUIProps["results"]) : undefined,
          resultsCount: resultsCount ?? (Array.isArray(results) ? results.length : undefined),
        },
      };
    }
    case "get_current_time": {
      const out = output as { time?: string; date?: string; dayOfWeek?: string; timezone?: string } | undefined;
      return {
        uiType: UI_BLOCK_TYPES.TIME_DISPLAY,
        uiProps: {
          time: out?.time,
          date: out?.date,
          dayOfWeek: out?.dayOfWeek,
          timezone: out?.timezone,
        },
      };
    }
    default:
      // Every tool gets a block so UI is fully driven by stream order (no fixed "web_search only" mold)
      return {
        uiType: UI_BLOCK_TYPES.TOOL_STEP,
        uiProps: {
          tool: toolSlug,
          input,
          ...(steps != null && steps.length > 0 && { steps }),
        },
      };
  }
}

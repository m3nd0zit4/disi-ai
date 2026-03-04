/**
 * Tool definition for the agent tool registry.
 * execute can be a custom function, HTTP call, or MCP client (extensible later).
 *
 * External tools:
 * - type "http": execute can call fetch(url, { method, headers, body }) and return parsed result.
 * - type "mcp": execute can delegate to an MCP client (e.g. connect to MCP server, send tool call, return result).
 * - type "custom" (default): execute is a normal async function (e.g. get_current_time).
 * New tools are added via registerTool(); HTTP/MCP tools can be registered with execute wrappers that call external endpoints.
 */

import type { z } from "zod";

export interface ToolDefinition<INPUT = unknown, OUTPUT = unknown> {
  name: string;
  description: string;
  parameters: z.ZodType<INPUT>;
  execute: (args: INPUT) => Promise<OUTPUT>;
  /** "custom" = in-process function; "http" = call external API; "mcp" = MCP server tool. */
  type?: "custom" | "http" | "mcp";
}

export type ToolRegistry = Map<string, ToolDefinition>;

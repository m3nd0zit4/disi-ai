/**
 * Agent configuration for specialized agents (e.g. user-created agents).
 * The runner (streamText with tools + maxSteps, or runToolLoop) can accept
 * AgentConfig to apply systemPrompt and only the listed tools.
 */

export interface AgentConfig {
  /** Display name of the agent */
  name: string;
  /** System prompt for this agent */
  systemPrompt: string;
  /** Tool names from the registry to enable (e.g. ["get_current_time", "web_search"]) */
  toolNames: string[];
  /** Max steps for the tool loop (default 5) */
  maxSteps?: number;
  /** Model ID to use (optional; when not set, use request/default model) */
  modelId?: string;
  /** Provider to use (optional; when not set, use request/default provider) */
  provider?: string;
  /**
   * Optional references to external tools (URL, MCP server, etc.).
   * Resolved at runtime when implementing custom agents with HTTP/MCP tools.
   */
  externalToolRefs?: Array<{
    type: "http" | "mcp";
    name: string;
    /** For http: endpoint URL; for mcp: server identifier or URL */
    url?: string;
    /** Optional config (headers for HTTP, etc.) */
    config?: Record<string, unknown>;
  }>;
}

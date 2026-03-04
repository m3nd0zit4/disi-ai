/**
 * Agent module: config types, tool registry, and (future) runner that accepts AgentConfig.
 */

export type { AgentConfig } from "./types";
export {
  registerTool,
  getTool,
  getRegisteredToolNames,
  getAISDKToolsForNames,
} from "./tools";
export type { ToolDefinition, ToolRegistry } from "./tools";
export {
  getBuiltInToolsForProvider,
  getBuiltInToolsToEnable,
  getAvailableToolNames,
  BUILTIN_TOOL_SLUGS,
} from "./built-in-tools";
export type { BuiltInToolSlug, BuiltInToolsOptions } from "./built-in-tools";

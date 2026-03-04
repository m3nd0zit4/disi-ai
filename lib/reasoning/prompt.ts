import { ReasoningContext } from "./types";
import {
  buildEnhancedSystemPrompt,
  detectTaskType,
  MARKDOWN_GUIDELINES
} from "./prompts";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface BuildPromptOptions {
  systemPrompt?: string;
  context: ReasoningContext;
  userInput: string;
  taskType?: 'coding' | 'analysis' | 'creative' | 'research' | 'general';
  webSearchEnabled?: boolean;
  thinkingEnabled?: boolean;
  autoDetectTaskType?: boolean;
  /** When true, system prompt includes guidelines to prioritize successful tool results */
  toolsEnabled?: boolean;
}

/**
 * Builds the prompt messages for the AI model based on the reasoning context.
 *
 * @param systemPrompt The base system prompt.
 * @param context The resolved reasoning context.
 * @param userInput The specific input for the current node (if any).
 * @returns Array of chat messages.
 */
export function buildReasoningPrompt(
  systemPrompt: string | undefined,
  context: ReasoningContext,
  userInput: string
): ChatMessage[] {
  return buildEnhancedReasoningPrompt({
    systemPrompt,
    context,
    userInput,
    autoDetectTaskType: true,
  });
}

/**
 * Builds enhanced prompt messages with task-specific guidance and capabilities.
 *
 * @param options Configuration options for prompt building
 * @returns Array of chat messages
 */
export function buildEnhancedReasoningPrompt(options: BuildPromptOptions): ChatMessage[] {
  const {
    systemPrompt,
    context,
    userInput,
    taskType: specifiedTaskType,
    webSearchEnabled = false,
    thinkingEnabled = false,
    autoDetectTaskType = true,
    toolsEnabled = false,
  } = options;

  const messages: ChatMessage[] = [];

  // 1. Determine task type (auto-detect or use specified)
  const taskType = specifiedTaskType ||
    (autoDetectTaskType ? detectTaskType(userInput) : 'general');

  // 2. Build enhanced system prompt
  const enhancedPrompt = buildEnhancedSystemPrompt({
    taskType,
    customPrompt: systemPrompt,
    includeMarkdownGuidelines: true,
    includeReasoningGuidelines: thinkingEnabled,
    includeWebSearchGuidelines: webSearchEnabled,
    webSearchEnabled,
    thinkingEnabled,
    toolsEnabled,
  });

  // 3. Add context distillation marker
  const distilledMarker = context.isDistilled
    ? "\n\n(Note: Context has been distilled for efficiency, focusing on most relevant information.)"
    : "";

  // 4. Build context section
  const contextSection = context.items.length > 0 ? `

CONTEXT AVAILABLE:
${context.items.map(item => `
- ${item.role.toUpperCase()} (Importance: ${item.importance}/5):
  """
  ${item.content}
  """`).join("\n")}
` : "";

  // 5. Compose full system message
  const systemMessageContent = `${enhancedPrompt}${distilledMarker}${contextSection}`;

  messages.push({
    role: "system",
    content: systemMessageContent.trim()
  });

  // 6. Add user input
  if (userInput) {
    messages.push({
      role: "user",
      content: userInput
    });
  } else if (context.items.length > 0) {
    // Fallback if no explicit user input
    messages.push({
      role: "user",
      content: "Proceed with the task based on the context provided above."
    });
  }

  return messages;
}

/**
 * Legacy compatibility - builds basic prompt without enhancements
 */
export function buildBasicReasoningPrompt(
  systemPrompt: string | undefined,
  context: ReasoningContext,
  userInput: string
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  const baseSystemPrompt = systemPrompt || "You are an AI model operating inside a structured reasoning graph.";

  const distilledMarker = context.isDistilled
    ? "\n(Note: The following context has been distilled for efficiency, focusing on the most relevant information.)"
    : "";

  const systemMessageContent = `${baseSystemPrompt}${distilledMarker}

OUTPUT FORMAT: Respond in Markdown. Use headings, lists, code blocks, and formatting as appropriate. Do not mix reasoning with the final answer; if you expose thinking, keep it separate from the main response.

CONTEXT (DISTILLED):
${context.items.map(item => `
- ${item.role.toUpperCase()} (Importance: ${item.importance}/5):
  """
  ${item.content}
  """`).join("\n")}
`;

  messages.push({
    role: "system",
    content: systemMessageContent.trim()
  });

  if (userInput) {
    messages.push({
      role: "user",
      content: userInput
    });
  } else if (context.items.length > 0) {
    messages.push({
      role: "user",
      content: "Proceed with the task based on the context provided above."
    });
  }

  return messages;
}

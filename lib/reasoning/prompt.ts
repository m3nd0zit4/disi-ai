import { ReasoningContext } from "./types";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
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
  const messages: ChatMessage[] = [];

  // 1. System Prompt
  const baseSystemPrompt = systemPrompt || "You are an AI model operating inside a structured reasoning graph.";
  
  const distilledMarker = context.isDistilled ? "\n(Note: The following context has been distilled for efficiency, focusing on the most relevant information.)" : "";

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

  // 2. User Input (The current node's specific instruction/prompt)
  if (userInput) {
    messages.push({
      role: "user",
      content: userInput
    });
  } else if (context.items.length > 0) {
      // If no explicit user input, but we have context, we might need a default trigger.
      // Or we just send the context as system and an empty user message? 
      // Some models fail with empty user message.
      // Let's assume if there's no input, the context implies "continue" or "process this".
      messages.push({
          role: "user",
          content: "Proceed with the task based on the context provided above."
      });
  }

  return messages;
}

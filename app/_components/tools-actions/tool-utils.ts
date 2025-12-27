import { SpecializedModel, isGeminiModel, isOpenAIModel, isClaudeModel, isGrokModel, isDeepSeekModel } from "@/types/AiModel";
import { ToolDefinition } from "./ToolsRegistry";
import { GeminiMetadata } from "@/types/ai-models/gemini";
import { OpenAIMetadata } from "@/types/ai-models/openai";
import { ClaudeMetadata } from "@/types/ai-models/claude";
import { GrokMetadata } from "@/types/ai-models/grok";
import { DeepSeekMetadata } from "@/types/ai-models/deepseek";

/**
 * Type-safe check for tool support across different providers
 */
export function checkToolSupport(modelDef: SpecializedModel, tool: ToolDefinition): boolean {
  // 1. GEMINI
  if (isGeminiModel(modelDef)) {
    const metadata = modelDef.providerMetadata.metadata;
    const toolId = tool.providerIds.gemini;

    // Special cases for Gemini (Agents & Capabilities)
    if (tool.id === "deepResearch" && metadata.agents?.deepResearch) return true;
    if (tool.id === "imageGeneration" && metadata.capabilities?.imageGeneration) return true;

    // Standard tools
    if (toolId && metadata.tools) {
      return !!metadata.tools[toolId as keyof GeminiMetadata["tools"]];
    }
    return false;
  }

  // 2. OPENAI
  if (isOpenAIModel(modelDef)) {
    const metadata = modelDef.providerMetadata.metadata;
    const toolId = tool.providerIds.openai;

    if (toolId && metadata.tools) {
      return !!metadata.tools[toolId as keyof NonNullable<OpenAIMetadata["tools"]>];
    }
    return false;
  }

  // 3. CLAUDE
  if (isClaudeModel(modelDef)) {
    const metadata = modelDef.providerMetadata.metadata;
    const toolId = tool.providerIds.claude;

    if (toolId && metadata.tools) {
      return !!metadata.tools[toolId as keyof NonNullable<ClaudeMetadata["tools"]>];
    }
    return false;
  }

  // 4. GROK
  if (isGrokModel(modelDef)) {
    const metadata = modelDef.providerMetadata.metadata;
    const toolId = tool.providerIds.grok;

    if (toolId && metadata.tools) {
      return !!metadata.tools[toolId as keyof NonNullable<GrokMetadata["tools"]>];
    }
    return false;
  }

  // 5. DEEPSEEK
  if (isDeepSeekModel(modelDef)) {
    const metadata = modelDef.providerMetadata.metadata;
    const toolId = tool.providerIds.deepseek;

    if (toolId && metadata.features) {
      return !!metadata.features[toolId as keyof NonNullable<DeepSeekMetadata["features"]>];
    }
    return false;
  }

  return false;
}

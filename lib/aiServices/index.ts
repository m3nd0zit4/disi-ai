import { OpenAIService } from "./openai";
import { AnthropicService } from "./anthropic";
import { GoogleService } from "./google";
import { XAIService } from "./xai";
import { DeepSeekService } from "./deepseek";
import { BaseAIService } from "./base";

export function getAIService(
  provider: string,
  apiKey: string
): BaseAIService {
  console.log("[getAIService] Creating service for provider:", {
    provider,
    providerLowercase: provider.toLowerCase(),
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
  });

  switch (provider.toLowerCase()) {
    case "gpt":
    case "openai":
      console.log("[getAIService] Creating OpenAIService");
      return new OpenAIService(apiKey);

    case "claude":
    case "anthropic":
      console.log("[getAIService] Creating AnthropicService");
      return new AnthropicService(apiKey);

    case "gemini":
    case "google":
      console.log("[getAIService] Creating GoogleService");
      return new GoogleService(apiKey);

    case "grok":
    case "xai":
      console.log("[getAIService] Creating XAIService");
      return new XAIService(apiKey);

    case "deepseek":
      console.log("[getAIService] Creating DeepSeekService");
      return new DeepSeekService(apiKey);

    default:
      console.error("[getAIService] Unsupported provider:", provider);
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

export * from "./base";
export * from "./openai";
export * from "./anthropic";
export * from "./google";
export * from "./xai";
export * from "./deepseek";
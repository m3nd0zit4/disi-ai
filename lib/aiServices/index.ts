import { OpenAIService } from "./openai";
import { AnthropicService } from "./anthropic";
import { BaseAIService } from "./base";

export function getAIService(
  provider: string,
  apiKey: string
): BaseAIService {
  switch (provider.toLowerCase()) {
    case "gpt":
    case "openai":
      return new OpenAIService(apiKey);
    
    case "claude":
    case "anthropic":
      return new AnthropicService(apiKey);
    
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

export * from "./base";
export * from "./openai";
export * from "./anthropic";
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
  switch (provider.toLowerCase()) {
    case "gpt":
    case "openai":
      return new OpenAIService(apiKey);
    
    case "claude":
    case "anthropic":
      return new AnthropicService(apiKey);
    
    case "gemini":
    case "google":
      return new GoogleService(apiKey);
    
    case "grok":
    case "xai":
      return new XAIService(apiKey);
    
    case "deepseek":
      return new DeepSeekService(apiKey);
    
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

export * from "./base";
export * from "./openai";
export * from "./anthropic";
export * from "./google";
export * from "./xai";
export * from "./deepseek";
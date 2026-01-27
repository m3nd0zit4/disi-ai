import Anthropic from "@anthropic-ai/sdk";
import { BaseAIService, AIRequest, AIResponse } from "./base";

export class AnthropicService extends BaseAIService {
  public client: Anthropic;

  constructor(apiKey: string) {
    super({ apiKey, baseURL: "https://api.anthropic.com" });
    this.client = new Anthropic({ apiKey });
  }

  //* Generate a response
  async generateResponse(request: AIRequest): Promise<AIResponse> {

    
    // Format messages
    const messages = request.messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }));
  
    const systemMessage: string | undefined = request.messages.find(m => m.role === "system")?.content;

    const completion = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens ?? 1024,
      system: systemMessage,
      messages,
      stream: false,
    }, { signal: request.signal });

    const tokens = completion.usage.input_tokens + completion.usage.output_tokens;
    
    return {
      content: completion.content[0].type === "text" 
        ? completion.content[0].text 
        : "",
      tokens,
      cost: this.calculateCost(request.model, tokens),
      finishReason: completion.stop_reason ?? "complete",
    };
  }

  //* Generate a stream of responses
  async generateStreamResponse(request: AIRequest): Promise<ReturnType<Anthropic['messages']['stream']>> {
    const messages = request.messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }));
    
    const systemMessage: string | undefined = request.messages.find(m => m.role === "system")?.content;

    return this.client.messages.stream({
      model: request.model,
      max_tokens: request.maxTokens ?? 1024,
      system: systemMessage,
      messages,
    }, { signal: request.signal })
  }
    
  //* Calculate the cost of a request
  //TODO: Hardcoded prices (January 2026)
  private calculateCost(model: string, tokens: number): number {
    const pricing: Record<string, number> = {
      // Claude 4.5 models
      "claude-sonnet-4-5-20250929": 0.003 / 1000,
      "claude-haiku-4-5-20251001": 0.001 / 1000,
      "claude-opus-4-5-20251101": 0.005 / 1000,
      // Legacy models
      "claude-opus-4-1-20250805": 0.015 / 1000,
      "claude-sonnet-4-20250514": 0.003 / 1000,
      "claude-3-haiku-20240307": 0.00025 / 1000,
    };
    return tokens * (pricing[model] ?? 0.003);
  }

  //* Validate the API key
  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [{ role: "user", content: "test" }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
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
    }, { abortSignal: request.signal });

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
    }, { abortSignal: request.signal })
  }
    
  //* Calculate the cost of a request
  //TODO: Hardcoded prices
  private calculateCost(model: string, tokens: number): number {
    const pricing: Record<string, number> = {
      "claude-3-opus-20240229": 0.015 / 1000,
      "claude-3-sonnet-20240229": 0.003 / 1000,
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
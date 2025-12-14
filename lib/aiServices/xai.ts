import OpenAI from "openai";
import { BaseAIService, AIRequest, AIResponse } from "./base";

export class XAIService extends BaseAIService {
  public client: OpenAI;

  constructor(apiKey: string) {
    super({ apiKey, baseURL: "https://api.x.ai/v1" });
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1",
    });
  }

  //* Generate a response (non-streaming)
  async generateResponse(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    const completion = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: false,
    });

    const responseTime = (Date.now() - startTime) / 1000;
    const tokens = completion.usage?.total_tokens ?? 0;
    
    return {
      content: completion.choices[0].message.content ?? "",
      tokens,
      cost: this.calculateCost(request.model, tokens),
      finishReason: completion.choices[0].finish_reason ?? "stop",
    };
  }

  //* Calculate cost
  //TODO: Hardcoded prices
  private calculateCost(model: string, tokens: number): number {
    const pricing: Record<string, number> = {
      "grok-beta": 0.005 / 1000, // Estimado $5 per 1M tokens
      "grok-2-latest": 0.005 / 1000,
    };
    return tokens * (pricing[model] ?? 0.005);
  }

  //* Validate API key
  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
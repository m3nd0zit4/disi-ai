import OpenAI from "openai";
import { BaseAIService, AIRequest, AIResponse } from "./base";

export class OpenAIService extends BaseAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    super({ apiKey, baseURL: "https://api.openai.com/v1" });
    this.client = new OpenAI({ apiKey });
  }

  async generateResponse(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    const completion = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
    });

    const responseTime = (Date.now() - startTime) / 1000;
    const tokens = completion.usage?.total_tokens ?? 0;
    
    return {
      content: completion.choices[0].message.content ?? "",
      tokens,
      cost: this.calculateCost(request.model, tokens),
      finishReason: completion.choices[0].finish_reason,
    };
  }

  private calculateCost(model: string, tokens: number): number {
    // Pricing por modelo (actualizar según precios reales)
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4": { input: 0.03 / 1000, output: 0.06 / 1000 },
      "gpt-3.5-turbo": { input: 0.001 / 1000, output: 0.002 / 1000 },
    };
    
    const modelPricing = pricing[model] ?? pricing["gpt-3.5-turbo"];
    return tokens * modelPricing.input; // Simplificado
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
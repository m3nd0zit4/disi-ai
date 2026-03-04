import Anthropic from "@anthropic-ai/sdk";
import { BaseAIService, AIRequest, AIResponse } from "./base";

interface AnthropicWebSearchConfig {
  enabled: boolean;
  maxUses?: number;
  allowedDomains?: string[];
  blockedDomains?: string[];
  userLocation?: {
    type: "approximate";
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
  };
}

interface EnhancedAIRequest extends AIRequest {
  webSearch?: AnthropicWebSearchConfig;
  thinking?: {
    enabled: boolean;
    budgetTokens?: number;
  };
}

export class AnthropicService extends BaseAIService {
  public client: Anthropic;

  constructor(apiKey: string) {
    super({ apiKey, baseURL: "https://api.anthropic.com" });
    this.client = new Anthropic({ apiKey });
  }

  //* Generate a response
  async generateResponse(request: AIRequest): Promise<AIResponse> {
    const enhancedRequest = request as EnhancedAIRequest;

    console.log("[AnthropicService] generateResponse called:", {
      model: request.model,
      messageCount: request.messages.length,
      maxTokens: request.maxTokens,
      webSearch: enhancedRequest.webSearch?.enabled,
      thinking: enhancedRequest.thinking?.enabled,
    });

    // Format messages
    const messages = request.messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }));

    const systemMessage: string | undefined = request.messages.find(m => m.role === "system")?.content;

    // Build tools array
    const tools: any[] = [];

    if (enhancedRequest.webSearch?.enabled) {
      const webSearchTool: any = {
        type: "web_search_20250305",
        name: "web_search",
      };

      if (enhancedRequest.webSearch.maxUses) {
        webSearchTool.max_uses = enhancedRequest.webSearch.maxUses;
      }

      if (enhancedRequest.webSearch.allowedDomains) {
        webSearchTool.allowed_domains = enhancedRequest.webSearch.allowedDomains;
      }

      if (enhancedRequest.webSearch.blockedDomains) {
        webSearchTool.blocked_domains = enhancedRequest.webSearch.blockedDomains;
      }

      if (enhancedRequest.webSearch.userLocation) {
        webSearchTool.user_location = enhancedRequest.webSearch.userLocation;
      }

      tools.push(webSearchTool);
    }

    console.log("[AnthropicService] Calling Anthropic API with model:", request.model);

    let maxTokensCreate = request.maxTokens ?? 8000;
    const budgetTokensCreate = enhancedRequest.thinking?.enabled ? (enhancedRequest.thinking.budgetTokens || 10000) : undefined;
    if (budgetTokensCreate != null && maxTokensCreate <= budgetTokensCreate) {
      maxTokensCreate = budgetTokensCreate + 1024;
    }
    const completion = await this.client.messages.create({
      model: request.model,
      max_tokens: maxTokensCreate,
      system: systemMessage,
      messages,
      stream: false,
      ...(tools.length > 0 && { tools }),
      ...(enhancedRequest.thinking?.enabled && budgetTokensCreate != null && {
        thinking: {
          type: "enabled",
          budget_tokens: budgetTokensCreate,
        }
      }),
    }, { signal: request.signal });

    console.log("[AnthropicService] Response received, stop_reason:", completion.stop_reason);

    // Extract thinking content if available
    let thinkingContent = "";
    const textContent: string[] = [];

    for (const block of completion.content) {
      if (block.type === "thinking") {
        thinkingContent += block.thinking;
      } else if (block.type === "text") {
        textContent.push(block.text);
      }
    }

    const inputTokens = completion.usage.input_tokens;
    const outputTokens = completion.usage.output_tokens;
    const tokens = inputTokens + outputTokens;

    return {
      content: textContent.join("\n"),
      tokens: { input: inputTokens, output: outputTokens, total: tokens },
      cost: this.calculateCost(request.model, tokens),
      finishReason: completion.stop_reason ?? "complete",
      thinkingContent: thinkingContent || undefined,
      citations: this.extractCitations(completion.content),
    };
  }

  //* Generate a stream of responses
  //* Wraps the Anthropic stream to inject citations from finalMessage at the end
  async *generateStreamResponse(request: AIRequest): AsyncIterable<any> {
    const enhancedRequest = request as EnhancedAIRequest;

    const messages = request.messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }));

    const systemMessage: string | undefined = request.messages.find(m => m.role === "system")?.content;

    // Build tools (same as non-streaming)
    const tools: any[] = [];

    if (enhancedRequest.webSearch?.enabled) {
      const webSearchTool: any = {
        type: "web_search_20250305",
        name: "web_search",
      };

      if (enhancedRequest.webSearch.maxUses) {
        webSearchTool.max_uses = enhancedRequest.webSearch.maxUses;
      }

      if (enhancedRequest.webSearch.allowedDomains) {
        webSearchTool.allowed_domains = enhancedRequest.webSearch.allowedDomains;
      }

      if (enhancedRequest.webSearch.blockedDomains) {
        webSearchTool.blocked_domains = enhancedRequest.webSearch.blockedDomains;
      }

      if (enhancedRequest.webSearch.userLocation) {
        webSearchTool.user_location = enhancedRequest.webSearch.userLocation;
      }

      tools.push(webSearchTool);
    }

    let maxTokensVal = request.maxTokens ?? 8000;
    const budgetTokensVal = enhancedRequest.thinking?.enabled ? (enhancedRequest.thinking.budgetTokens || 10000) : undefined;
    if (budgetTokensVal != null && maxTokensVal <= budgetTokensVal) {
      maxTokensVal = budgetTokensVal + 1024;
    }
    const stream = this.client.messages.stream({
      model: request.model,
      max_tokens: maxTokensVal,
      system: systemMessage,
      messages,
      ...(tools.length > 0 && { tools }),
      ...(enhancedRequest.thinking?.enabled && budgetTokensVal != null && {
        thinking: {
          type: "enabled",
          budget_tokens: budgetTokensVal,
        }
      }),
    }, { signal: request.signal });

    // Yield all stream events
    for await (const event of stream) {
      yield event;
    }

    // After streaming completes, extract citations from final message
    try {
      const finalMessage = await stream.finalMessage();
      const citations = this.extractCitations(finalMessage.content);

      if (citations.length > 0) {
        console.log(`[Anthropic] Extracted ${citations.length} citations from final message`);
        // Emit a special event with citations that stream normalizer can catch
        yield {
          type: "citations_extracted",
          citations: citations,
        };
      }
    } catch (e) {
      console.warn("[Anthropic] Could not extract citations from final message:", e);
    }
  }
    
  //* Extract citations from response content with full metadata
  private extractCitations(content: any[]): Array<{
    url: string;
    title: string;
    description?: string;
    domain?: string;
    favicon?: string;
  }> {
    const citations: Array<{
      url: string;
      title: string;
      description?: string;
      domain?: string;
      favicon?: string;
    }> = [];
    const seenUrls = new Set<string>();

    for (const block of content) {
      if (block.type === "text" && block.citations) {
        for (const citation of block.citations) {
          if (citation.type === "web_search_result_location" && !seenUrls.has(citation.url)) {
            seenUrls.add(citation.url);

            // Extract domain from URL
            let domain = "";
            try {
              domain = new URL(citation.url).hostname.replace("www.", "");
            } catch {
              domain = citation.url;
            }

            citations.push({
              url: citation.url,
              title: citation.title,
              description: citation.snippet || citation.text || "",
              domain,
              favicon: `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(citation.url)}`,
            });
          }
        }
      }
    }

    return citations;
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
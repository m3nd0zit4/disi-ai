import OpenAI from "openai";
import { BaseAIService, AIRequest, AIResponse } from "./base";

interface GrokSearchConfig {
  webSearch?: {
    enabled: boolean;
    allowedDomains?: string[];
    excludedDomains?: string[];
    enableImageUnderstanding?: boolean;
    userLocation?: {
      country?: string;
      city?: string;
      region?: string;
      timezone?: string;
    };
  };
  xSearch?: {
    enabled: boolean;
    allowedHandles?: string[];
    excludedHandles?: string[];
    fromDate?: string;
    toDate?: string;
    enableImageUnderstanding?: boolean;
    enableVideoUnderstanding?: boolean;
  };
}

interface EnhancedGrokRequest extends AIRequest {
  search?: GrokSearchConfig;
  includeCitations?: boolean;
}

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
    const enhancedRequest = request as EnhancedGrokRequest;
    const startTime = Date.now();

    console.log("[XAIService] generateResponse called:", {
      model: request.model,
      messageCount: request.messages.length,
      temperature: request.temperature,
      webSearch: enhancedRequest.search?.webSearch?.enabled,
      xSearch: enhancedRequest.search?.xSearch?.enabled,
    });

    const useTools =
      enhancedRequest.search?.webSearch?.enabled || enhancedRequest.search?.xSearch?.enabled;

    if (useTools) {
      const input = request.messages.map((m) => ({
        role: (m.role === "system" ? "developer" : m.role) as "user" | "assistant" | "developer",
        content: m.content,
      }));
      const tools: any[] = [];
      if (enhancedRequest.search?.webSearch?.enabled) {
        const t: any = { type: "web_search" };
        if (enhancedRequest.search.webSearch.allowedDomains) t.filters = { allowed_domains: enhancedRequest.search.webSearch.allowedDomains };
        if (enhancedRequest.search.webSearch.excludedDomains) t.filters = { ...t.filters, excluded_domains: enhancedRequest.search.webSearch.excludedDomains };
        if (enhancedRequest.search.webSearch.enableImageUnderstanding) t.enable_image_understanding = true;
        if (enhancedRequest.search.webSearch.userLocation) t.user_location = { type: "approximate", ...enhancedRequest.search.webSearch.userLocation };
        tools.push(t);
      }
      if (enhancedRequest.search?.xSearch?.enabled) {
        const t: any = { type: "x_search" };
        if (enhancedRequest.search.xSearch.allowedHandles) t.allowed_x_handles = enhancedRequest.search.xSearch.allowedHandles;
        if (enhancedRequest.search.xSearch.excludedHandles) t.excluded_x_handles = enhancedRequest.search.xSearch.excludedHandles;
        if (enhancedRequest.search.xSearch.fromDate) t.from_date = enhancedRequest.search.xSearch.fromDate;
        if (enhancedRequest.search.xSearch.toDate) t.to_date = enhancedRequest.search.xSearch.toDate;
        if (enhancedRequest.search.xSearch.enableImageUnderstanding) t.enable_image_understanding = true;
        if (enhancedRequest.search.xSearch.enableVideoUnderstanding) t.enable_video_understanding = true;
        tools.push(t);
      }
      const response = await this.client.responses.create(
        {
          model: request.model,
          input,
          max_output_tokens: request.maxTokens ?? 8192,
          temperature: request.temperature ?? 0.7,
          stream: false,
          tools,
          store: false,
          ...(enhancedRequest.includeCitations && { include: ["web_search_call.action.sources"] }),
        },
        { signal: request.signal }
      );
      const content = this.extractOutputTextFromResponse(response);
      const tokens = response.usage?.total_tokens ?? Math.ceil((content?.length ?? 0) / 4);
      return {
        content: content ?? "",
        tokens,
        cost: this.calculateCost(request.model, tokens),
        finishReason: "stop",
        citations: this.extractGrokCitationsFromResponse(response),
      };
    }

    const completion = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: false,
    } as any);

    console.log("[XAIService] Response received, finish_reason:", completion.choices[0]?.finish_reason);

    const responseTime = (Date.now() - startTime) / 1000;
    const tokens = completion.usage?.total_tokens ?? 0;

    const content = completion.choices[0].message.content ?? "";

    return {
      content,
      tokens,
      cost: this.calculateCost(request.model, tokens),
      finishReason: completion.choices[0].finish_reason,
      citations: this.extractGrokCitations(completion as any),
    };
  }

  private extractOutputTextFromResponse(response: any): string {
    const output = response.output as Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> | undefined;
    if (!Array.isArray(output)) return "";
    let text = "";
    for (const item of output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part.type === "output_text" && typeof part.text === "string") text += part.text;
        }
      }
    }
    return text;
  }

  private extractGrokCitationsFromResponse(response: any): Array<{ url: string; title: string }> {
    const citations: Array<{ url: string; title: string }> = [];
    if (response.citations?.length) {
      for (const c of response.citations) {
        citations.push({ url: c.url ?? "", title: c.title ?? "" });
      }
    }
    const output = response.output as any[] | undefined;
    if (Array.isArray(output)) {
      for (const item of output) {
        if (item.type === "web_search_call" && item.action?.sources?.length) {
          for (const s of item.action.sources) {
            citations.push({ url: s.url ?? "", title: s.title ?? "" });
          }
        }
      }
    }
    return citations;
  }

  //* Generate a stream of responses
  async generateStreamResponse(request: AIRequest): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    const enhancedRequest = request as EnhancedGrokRequest;
    const useTools =
      enhancedRequest.search?.webSearch?.enabled || enhancedRequest.search?.xSearch?.enabled;

    if (useTools) {
      return this.generateStreamResponseViaResponsesAPI(request, enhancedRequest);
    }

    return this.client.chat.completions.create({
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: true,
    } as any, {
      signal: request.signal,
    });
  }

  /**
   * Use xAI Responses API (Agent Tools) for web search. Legacy live_search is deprecated (410).
   * @see https://docs.x.ai/docs/guides/tools/overview
   */
  private async generateStreamResponseViaResponsesAPI(
    request: AIRequest,
    enhancedRequest: EnhancedGrokRequest
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    const input = request.messages.map((m) => ({
      role: (m.role === "system" ? "developer" : m.role) as "user" | "assistant" | "developer",
      content: m.content,
    }));

    const tools: any[] = [];
    if (enhancedRequest.search?.webSearch?.enabled) {
      const webSearchTool: any = {
        type: "web_search",
      };
      if (enhancedRequest.search.webSearch.allowedDomains) {
        webSearchTool.filters = { allowed_domains: enhancedRequest.search.webSearch.allowedDomains };
      }
      if (enhancedRequest.search.webSearch.excludedDomains) {
        webSearchTool.filters = {
          ...webSearchTool.filters,
          excluded_domains: enhancedRequest.search.webSearch.excludedDomains,
        };
      }
      if (enhancedRequest.search.webSearch.enableImageUnderstanding) {
        webSearchTool.enable_image_understanding = true;
      }
      if (enhancedRequest.search.webSearch.userLocation) {
        webSearchTool.user_location = {
          type: "approximate",
          ...enhancedRequest.search.webSearch.userLocation,
        };
      }
      tools.push(webSearchTool);
    }
    if (enhancedRequest.search?.xSearch?.enabled) {
      const xSearchTool: any = { type: "x_search" };
      if (enhancedRequest.search.xSearch.allowedHandles) {
        xSearchTool.allowed_x_handles = enhancedRequest.search.xSearch.allowedHandles;
      }
      if (enhancedRequest.search.xSearch.excludedHandles) {
        xSearchTool.excluded_x_handles = enhancedRequest.search.xSearch.excludedHandles;
      }
      if (enhancedRequest.search.xSearch.fromDate) xSearchTool.from_date = enhancedRequest.search.xSearch.fromDate;
      if (enhancedRequest.search.xSearch.toDate) xSearchTool.to_date = enhancedRequest.search.xSearch.toDate;
      if (enhancedRequest.search.xSearch.enableImageUnderstanding) {
        xSearchTool.enable_image_understanding = true;
      }
      if (enhancedRequest.search.xSearch.enableVideoUnderstanding) {
        xSearchTool.enable_video_understanding = true;
      }
      tools.push(xSearchTool);
    }

    const responseStream = await this.client.responses.create(
      {
        model: request.model,
        input,
        max_output_tokens: request.maxTokens ?? 8192,
        temperature: request.temperature ?? 0.7,
        stream: true,
        tools,
        store: false,
        ...(enhancedRequest.includeCitations && { include: ["web_search_call.action.sources"] }),
      },
      { signal: request.signal }
    );

    return this.mapResponsesStreamToChatChunks(responseStream);
  }

  private async *mapResponsesStreamToChatChunks(
    stream: AsyncIterable<Record<string, unknown>>
  ): AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> {
    for await (const event of stream) {
      const type = event.type as string | undefined;
      if (type === "response.content_part.added") {
        const part = event.part as { type?: string; text?: string } | undefined;
        if (part?.type === "output_text" && typeof part.text === "string" && part.text) {
          yield {
            id: "",
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: "",
            choices: [{ index: 0, delta: { content: part.text }, finish_reason: null }],
          } as OpenAI.Chat.Completions.ChatCompletionChunk;
        }
      } else if (
        type === "response.web_search_call.in_progress" ||
        type === "response.web_search_call.searching"
      ) {
        const webSearch = event.web_search_call as { input?: { query?: string } } | undefined;
        const query = webSearch?.input?.query ?? "";
        yield {
          id: "",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: "",
          choices: [
            {
              index: 0,
              delta: {
                content: undefined,
                tool_calls: [
                  {
                    index: 0,
                    id: "",
                    type: "function" as const,
                    function: { name: "web_search", arguments: JSON.stringify({ query }) },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        } as OpenAI.Chat.Completions.ChatCompletionChunk;
      } else if (type === "response.web_search_call.completed") {
        const webSearch = event.web_search_call as { action?: { sources?: Array<{ url?: string; title?: string }> } } | undefined;
        const sources = webSearch?.action?.sources ?? [];
        if (sources.length > 0) {
          yield {
            id: "",
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: "",
            choices: [{ index: 0, delta: {}, finish_reason: null }],
            citations: sources.map((s) => ({ url: s.url ?? "", title: s.title ?? "" })),
          } as any;
        }
      } else if (type === "response.completed") {
        yield {
          id: "",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: "",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        } as OpenAI.Chat.Completions.ChatCompletionChunk;
      }
    }
  }

  //* Extract citations from Grok response
  private extractGrokCitations(completion: any): Array<{url: string, title: string}> {
    const citations: Array<{url: string, title: string}> = [];

    // Grok returns citations in extensions
    if (completion.citations) {
      for (const citation of completion.citations) {
        citations.push({
          url: citation.url || "",
          title: citation.title || "",
        });
      }
    }

    return citations;
  }

  //* Calculate cost (per token, USD)
  private calculateCost(model: string, tokens: number): number {
    const perToken: Record<string, number> = {
      "grok-4-1-fast-reasoning": 0.00035 / 1000,
      "grok-4-1-fast-non-reasoning": 0.00035 / 1000,
      "grok-4": 0.003 / 1000,
      "grok-4-fast-reasoning": 0.00035 / 1000,
      "grok-4-fast-non-reasoning": 0.00035 / 1000,
      "grok-3": 0.003 / 1000,
      "grok-3-mini": 0.0004 / 1000,
    };
    return tokens * (perToken[model] ?? 0.003 / 1000);
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
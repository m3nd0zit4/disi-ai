import OpenAI from "openai";
import { BaseAIService, AIRequest, AIResponse, OrchestrationRequest, OrchestrationResponse, ImageGenerationRequest, VideoGenerationRequest, MediaResponse } from "./base";

export class OpenAIService extends BaseAIService {
  public client: OpenAI;

  constructor(apiKey: string) {
    super({ apiKey, baseURL: "https://api.openai.com/v1" });
    this.client = new OpenAI({ apiKey });
  }

  private isReasoningModel(model: any): boolean {
    if (typeof model !== 'string') return false;
    return model.startsWith('o1') || model.startsWith('o3') || model.includes('gpt-5');
  }

  //* Generate a response
  async generateResponse(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const isReasoning = this.isReasoningModel(request.model);
    
    const completion = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: isReasoning ? undefined : (request.temperature ?? 0.7),
      [isReasoning ? "max_completion_tokens" : "max_tokens"]: request.maxTokens,
      stream: false,
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, { signal: request.signal });

    const responseTime = (Date.now() - startTime) / 1000;
    const tokens = completion.usage?.total_tokens ?? 0;
    
    return {
      content: completion.choices[0].message.content ?? "",
      tokens,
      cost: this.calculateCost(request.model, tokens),
      finishReason: completion.choices[0].finish_reason,
    };
  }

  //* Generate a stream of responses
  async generateStreamResponse(request: AIRequest): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    const isReasoning = this.isReasoningModel(request.model);
    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: isReasoning ? undefined : (request.temperature ?? 0.7),
      [isReasoning ? "max_completion_tokens" : "max_tokens"]: request.maxTokens,
      stream: true,
    } as OpenAI.Chat.ChatCompletionCreateParamsStreaming, { signal: request.signal });
    return stream;
  }

  //* Calculate the cost of a request
  //TODO: Hardcoded prices
  private calculateCost(model: string, tokens: number): number {
    // Pricing por modelo (actualizar según precios reales)
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4": { input: 0.03 / 1000, output: 0.06 / 1000 },
      "gpt-3.5-turbo": { input: 0.001 / 1000, output: 0.002 / 1000 },
    };
    
    const modelPricing = pricing[model] ?? pricing["gpt-3.5-turbo"];
    return tokens * modelPricing.input; // Simplificado
  }

  //* Validate the API key
  //* Analyze if orchestration is needed using function calling
  async analyzeOrchestration(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    // Build tools from available specialized models
    const tools: OpenAI.Chat.ChatCompletionTool[] = [];
    
    console.log(`[Orchestration] Available tools for ${request.model}:`, JSON.stringify(request.availableTools, null, 2));

    const hasImageGen = request.availableTools.some(t => t.type === "image_generation");
    const hasVideoGen = request.availableTools.some(t => t.type === "video_generation");
    
    if (hasImageGen) {
      tools.push({
        type: "function",
        function: {
          name: "generate_image",
          description: "Generate an image based on a text description. Use this when the user asks for visual content, illustrations, pictures, or images.",
          parameters: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "Detailed description of the image to generate. Be specific about style, composition, colors, and subject matter."
              },
              reasoning: {
                type: "string",
                description: "Brief explanation of why generating this image helps answer the user's request."
              }
            },
            required: ["prompt", "reasoning"]
          }
        }
      });
    }
    
    if (hasVideoGen) {
      tools.push({
        type: "function",
        function: {
          name: "generate_video",
          description: "Generate a video based on a text description. Use this when the user asks for animations, video content, or moving visuals.",
          parameters: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "Detailed description of the video to generate. Include actions, movements, and scene details."
              },
              reasoning: {
                type: "string",
                description: "Brief explanation of why generating this video helps answer the user's request."
              }
            },
            required: ["prompt", "reasoning"]
          }
        }
      });
    }

    const isReasoning = this.isReasoningModel(request.model);

    // Build messages with system prompt for orchestration
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { 
        role: "system", 
        content: `You are an AI orchestrator. Your primary job is to decide if the user's request requires specialized tools (image or video generation). 

RULES:
1. If the user asks for an image, illustration, or visual content, you MUST call 'generate_image'.
2. If the user asks for a video or animation, you MUST call 'generate_video'.
3. DO NOT provide the image prompt in your text response.
4. DO NOT provide SVG code or any other code in your text response.
5. Keep your text response extremely brief (e.g., "Generating your image...").
6. If you call a tool, your text response should NOT contain the prompt you sent to the tool.
7. DO NOT output the tool call as JSON text. You MUST use the native tool calling capability.`
      },
      ...(request.messages as OpenAI.Chat.ChatCompletionMessageParam[])
    ];

    const requestPayload = {
      model: request.model,
      messages: messages,
      temperature: isReasoning ? undefined : (request.temperature ?? 0.7),
      [isReasoning ? "max_completion_tokens" : "max_tokens"]: request.maxTokens,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "required" : undefined,
    };

    console.log(`[Orchestration] Request payload for ${request.model}:`, JSON.stringify(requestPayload, null, 2));

    // Call GPT with tools
    const completion = await this.client.chat.completions.create(requestPayload as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

    console.log(`[Orchestration] Completion for ${request.model}:`, JSON.stringify(completion.choices[0].message, null, 2));

    const message = completion.choices[0].message;
    const toolCalls = message.tool_calls;

    // If no tool calls, return text response only
    if (!toolCalls || toolCalls.length === 0) {
      return {
        needsOrchestration: false,
        textResponse: message.content || "",
      };
    }

    // Parse tool calls into tasks
    const tasks = toolCalls.map(call => {
      // Type guard for function tool calls
      if (call.type !== 'function') return null;
      
      let args;
      try {
        args = JSON.parse(call.function.arguments);
      } catch (parseError) {
        console.error(`Failed to parse tool call arguments: ${call.function.arguments}`);
        return null;
      }
      const taskType = call.function.name === "generate_image" ? "image" : "video";
      
      // Find the appropriate model for this task type
      const tool = request.availableTools.find(t => 
        t.type === (taskType === "image" ? "image_generation" : "video_generation")
      );
      
      if (!tool) {
        console.warn(`No available tool found for task type: ${taskType}`);
        return null;
      }

      return {
        taskType: taskType as "image" | "video",
        modelId: tool.modelId,
        providerModelId: tool.providerModelId,
        prompt: args.prompt,
        reasoning: args.reasoning,
      };
    }).filter((task): task is NonNullable<typeof task> => task !== null);

    return {
      needsOrchestration: true,
      textResponse: message.content || "",
      tasks,
    };
  }

  //* Generate image using DALL-E or GPT Image
  async generateImage(request: ImageGenerationRequest): Promise<MediaResponse> {
    const isGptImage = request.model.includes("gpt-image");
    
    const params: any = {
      model: request.model,
      prompt: request.prompt,
      size: request.size || "1024x1024",
      n: 1,
    };

    // Only add quality if provided or if it's a DALL-E model (where it defaults to standard)
    if (request.quality) {
      params.quality = request.quality;
    } else if (!isGptImage) {
      params.quality = "standard";
    }

    // Add new GPT Image parameters if provided (OpenAI only accepts transparent | opaque | auto)
    const VALID_BACKGROUND = ["transparent", "opaque", "auto"] as const;
    const bg = request.background && VALID_BACKGROUND.includes(request.background as (typeof VALID_BACKGROUND)[number])
      ? (request.background as (typeof VALID_BACKGROUND)[number])
      : "opaque";
    params.background = bg;
    if (request.outputFormat) params.output_format = request.outputFormat;
    if (request.n) params.n = request.n;
    if (request.moderation) params.moderation = request.moderation;

    const response = await this.client.images.generate(params);

    if (!response.data || response.data.length === 0) {
      throw new Error("No image generated");
    }

    const imageData = response.data[0];
    const mediaUrl = imageData.url ?? (imageData.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null);
    
    if (!mediaUrl) {
      throw new Error("No image URL or base64 data returned");
    }

    return {
      mediaUrl,
      mediaType: "image",
      metadata: {
        revised_prompt: imageData.revised_prompt,
      },
    };
  }

  //* Generate video using Sora
  async generateVideo(request: VideoGenerationRequest): Promise<MediaResponse> {
    const isSora = request.model.includes("sora");

    if (!isSora) {
      throw new Error(`Model ${request.model} is not a video generation model`);
    }

    // Map aspect ratio to size
    // Map aspect ratio and resolution to size
    const getSoraSize = (aspectRatio: string = "16:9", resolution: string = "720p") => {
      const is1080p = resolution === "1080p";
      
      // Handle both formats: "16:9" and "1280x720"
      if (aspectRatio === "16:9" || aspectRatio === "1280x720") return is1080p ? "1920x1080" : "1280x720";
      if (aspectRatio === "9:16" || aspectRatio === "720x1280") return is1080p ? "1080x1920" : "720x1280";
      if (aspectRatio === "1:1" || aspectRatio === "1024x1024") return is1080p ? "1080x1080" : "1024x1024";
      
      // Handle Pro specific ratios
      if (aspectRatio === "1792x1024") return "1792x1024";
      if (aspectRatio === "1024x1792") return "1024x1792";
      
      return is1080p ? "1920x1080" : "1280x720";
    };
    
    const size = getSoraSize(request.aspectRatio, request.resolution);

    // Start video generation job
    // @ts-ignore - videos API may not be typed yet
    const video = await (this.client.videos as any).create({
      model: request.model as any,
      prompt: request.prompt,
      size: size as any,
      seconds: (request.duration || 4).toString() as any,
    });

    if (!video.id) {
      throw new Error("No video job ID returned");
    }

    // Poll for completion
    const maxAttempts = 180; // Max 15 minutes (5s * 180)
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      // @ts-ignore - videos API may not be typed yet
      const status = await this.client.videos.retrieve(video.id);

      if (status.status === "completed") {
        // Download the video content
        // @ts-ignore - videos API may not be typed yet
        const content = await this.client.videos.downloadContent(video.id);

        // Always convert to base64 to ensure the worker can process it
        const buffer = await content.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");

        return {
          mediaUrl: `data:video/mp4;base64,${base64}`,
          mediaType: "video",
          metadata: {
            model: request.model,
            prompt: request.prompt,
            duration: request.duration,
            videoId: video.id,
          },
        };
      }

      if (status.status === "failed") {
        const errorMsg = status.error?.message || "Video generation failed";
        throw new Error(errorMsg);
      }

      // Continue polling if status is "queued" or "in_progress"
    }

    throw new Error("Video generation timed out after 15 minutes");
  }

  //* Generate embedding
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
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
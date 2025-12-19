import OpenAI from "openai";
import { BaseAIService, AIRequest, AIResponse, OrchestrationRequest, OrchestrationResponse, ImageGenerationRequest, VideoGenerationRequest, MediaResponse } from "./base";

export class OpenAIService extends BaseAIService {
  public client: OpenAI;

  constructor(apiKey: string) {
    super({ apiKey, baseURL: "https://api.openai.com/v1" });
    this.client = new OpenAI({ apiKey });
  }

  //* Generate a response
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
      finishReason: completion.choices[0].finish_reason,
    };
  }

  //* Generate a stream of responses
  async generateStreamResponse(request: AIRequest) {
    return this.client.chat.completions.create({
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: true,
    })
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

    // Call GPT with tools
    const completion = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: request.temperature ?? 0.7,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
    });

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

  //* Generate image using DALL-E
  async generateImage(request: ImageGenerationRequest): Promise<MediaResponse> {
    const response = await this.client.images.generate({
      model: request.model,
      prompt: request.prompt,
      size: (request.size as "1024x1024" | "1024x1792" | "1792x1024") || "1024x1024",
      quality: (request.quality as "standard" | "hd") || "standard",
      n: 1,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No image generated");
    }

    return {
      mediaUrl: response.data[0].url!,
      mediaType: "image",
      metadata: {
        revised_prompt: response.data[0].revised_prompt,
      },
    };
  }

  //* Generate video (placeholder - Sora API not yet public)
  async generateVideo(request: VideoGenerationRequest): Promise<MediaResponse> {
    // TODO: Implement when Sora API is available
    throw new Error(`Video generation not yet available for ${request.model}. Sora API is not yet public.`);
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
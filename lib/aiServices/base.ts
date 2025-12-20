//* Base for all AI services
export interface AIServiceConfig {
    apiKey: string;
    baseURL: string;
}

export interface AIRequest {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
}

export interface AIResponse {
    content: string;
    tokens: number;
    cost: number;
    finishReason: string;
}

// Orchestration interfaces
export interface OrchestrationRequest extends AIRequest {
    availableTools: Array<{
        type: "image_generation" | "video_generation";
        modelId: string;
        providerModelId: string;
        modelName: string;
        provider: string;
    }>;
    userIntent: string;
}

export interface OrchestrationResponse {
    needsOrchestration: boolean;
    textResponse: string;
    tasks?: Array<{
        taskType: "image" | "video";
        modelId: string;
        providerModelId: string;
        prompt: string;
        reasoning: string;
    }>;
}

export interface ImageGenerationRequest {
    model: string;
    prompt: string;
    size?: string;
    quality?: string;
    aspectRatio?: string;
}

export interface VideoGenerationRequest {
    model: string;
    prompt: string;
    duration?: number;
    aspectRatio?: string;
}

export interface MediaResponse {
    mediaUrl: string;
    mediaType: "image" | "video";
    metadata?: Record<string, unknown>;
}

export abstract class BaseAIService {
    protected config: AIServiceConfig;
    
    constructor(config: AIServiceConfig) {
        this.config = config;
    }

    abstract generateResponse(request: AIRequest): Promise<AIResponse>;
    
    async generateStreamResponse(request: AIRequest): Promise<AsyncIterable<any>> {
        throw new Error("Streaming not supported by this service");
    }

    abstract validateApiKey(): Promise<boolean>;
    
    // Orchestration methods (optional - not all services support all features)
    async analyzeOrchestration(request: OrchestrationRequest): Promise<OrchestrationResponse> {
        // Default implementation: no orchestration
        const response = await this.generateResponse(request);
        return {
            needsOrchestration: false,
            textResponse: response.content,
        };
    }
    
    async generateImage(_request: ImageGenerationRequest): Promise<MediaResponse> {
        throw new Error("Image generation not supported by this service");
    }
    
    async generateVideo(_request: VideoGenerationRequest): Promise<MediaResponse> {
        throw new Error("Video generation not supported by this service");
    }
}
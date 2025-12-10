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

export abstract class BaseAIService {
    protected config: AIServiceConfig;
    
    constructor(config: AIServiceConfig) {
        this.config = config;
    }

    abstract generateResponse(request: AIRequest): Promise<AIResponse>;
    abstract validateApiKey(): Promise<boolean>;
}
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseAIService, AIRequest, AIResponse } from "./base";

export class GoogleService extends BaseAIService {
    public client: GoogleGenerativeAI;

    constructor(apiKey: string) {
        super({apiKey, baseURL: "https://generativelanguage.googleapis.com"});
        this.client = new GoogleGenerativeAI(apiKey);
    }

    //* Generate a response (non streaming)
    async generateResponse(request: AIRequest): Promise<AIResponse> {
        const startTime = Date.now();

        const model = this.client.getGenerativeModel({ model: request.model });

        // Format the prompt for gemini
        const chat = model.startChat({
            history: request.messages.slice(0, -1).map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            })),
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 2048,
            }
        });

        const lastMessage = request.messages[request.messages.length - 1];
        const result = await chat.sendMessage(lastMessage.content);
        const response = result.response;

        const responseTime = (Date.now() - startTime) / 1000;
        const content = response.text();
        
        //! Not always Gemini return exact number of tokens
        const tokens = response.usageMetadata?.totalTokenCount ?? Math.ceil(content.length / 4);

        return {
            content,
            tokens,
            cost: this.calculateCost(request.model, tokens),
            finishReason: "Complete",
        };
    }

    //* Generate a stream of responses
    async generateStreamResponse(request: AIRequest): Promise<AsyncIterable<any>> {
        const model = this.client.getGenerativeModel({ model: request.model });

        const chat = model.startChat({
            history: request.messages.slice(0, -1).map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            })),
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 2048,
            }
        });

        const lastMessage = request.messages[request.messages.length - 1];
        const result = await chat.sendMessageStream(lastMessage.content);
        return result.stream;
    }

    //* Calculate cost
    //TODO: Hardcoded prices
    private calculateCost(model: string, tokens: number): number {
        const pricing: Record<string, number> = {
            "gemini-3-pro-preview": 0.00125 / 1000,
            "gemini-3-flash-preview": 0.000075 / 1000,
            "gemini-2.5-flash": 0.000075 / 1000,
            "gemini-2.5-flash-preview-09-2025": 0.000075 / 1000,
            "gemini-2.5-flash-lite": 0.0000375 / 1000,
            "gemini-1.5-pro": 0.00125 / 1000,
            "gemini-1.5-flash": 0.000075 / 1000,
            "gemini-2.0-flash-exp": 0,
        };
        return tokens * (pricing[model] ?? 0.0001);
    }

    //* Validate API key
    async validateApiKey(): Promise<boolean> {
        try {
            const model = this.client.getGenerativeModel({ model: "gemini-1.5-flash" });
            await model.generateContent("test");
            return true;
        } catch {
            return false;
        }
    }
}
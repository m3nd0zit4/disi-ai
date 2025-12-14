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

        // Find the last user message
        const lastUserMessageIndex = request.messages.findLastIndex(msg => msg.role === "user");
        
        if (lastUserMessageIndex === -1) {
            throw new Error("No user message found in the request");
        }

        const lastUserMessage = request.messages[lastUserMessageIndex];
        
        // Extract system message if present
        const systemMessage = request.messages.find(msg => msg.role === "system");

        // Format history: exclude system message and messages after the last user message
        const historyMessages = request.messages.slice(0, lastUserMessageIndex).filter(msg => msg.role !== "system");

        // Format the prompt for gemini
        const chat = model.startChat({
            history: historyMessages.map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            })),
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 2048,
            },
            systemInstruction: systemMessage ? { role: "system", parts: [{ text: systemMessage.content }] } : undefined,
        });

        const result = await chat.sendMessage(lastUserMessage.content);
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

    //* Calculate cost
    //TODO: Hardcoded prices
    private calculateCost(model: string, tokens: number): number {
        const pricing: Record<string, number> = {
            "gemini-2.0-flash-exp": 0, // Free tier
            "gemini-1.5-pro": 0.00125 / 1000, // $0.00125 per 1K tokens (input)
            "gemini-1.5-flash": 0.000075 / 1000, // $0.000075 per 1K tokens
        };
        return tokens * (pricing[model] ?? 0.001);
    }

    //* Validate API key
    async validateApiKey(): Promise<boolean> {
        try {
            const model = this.client.getGenerativeModel({ model: "gemini-1.5-flash" });
            await model.countTokens("test");
            return true;
        } catch {
            return false;
        }
    }
}
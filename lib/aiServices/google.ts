import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseAIService, AIRequest, AIResponse, ImageGenerationRequest, VideoGenerationRequest, MediaResponse } from "./base";

export class GoogleService extends BaseAIService {
    public client: GoogleGenerativeAI;
    private apiKey: string;

    constructor(apiKey: string) {
        super({apiKey, baseURL: "https://generativelanguage.googleapis.com"});
        this.client = new GoogleGenerativeAI(apiKey);
        this.apiKey = apiKey;
    }

    //* Generate a response (non streaming)
    async generateResponse(request: AIRequest): Promise<AIResponse> {
        const startTime = Date.now();

        console.log("[GoogleService] generateResponse called:", {
            model: request.model,
            messageCount: request.messages.length,
            temperature: request.temperature,
        });

        const model = this.client.getGenerativeModel({ model: request.model });
        console.log("[GoogleService] Got generative model for:", request.model);

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
        const result = await chat.sendMessageStream(lastMessage.content, {
            signal: request.signal,
        });
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
            const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            await model.generateContent("test");
            return true;
        } catch {
            return false;
        }
    }

    //* Generate image using Gemini (Nano Banana)
    async generateImage(request: ImageGenerationRequest): Promise<MediaResponse> {
        const isNanoBanana = request.model.includes("gemini") && request.model.includes("image");

        if (!isNanoBanana) {
            throw new Error(`Model ${request.model} is not an image generation model`);
        }

        // Map size to aspectRatio and imageSize
        let aspectRatio = "1:1";
        let imageSize = "1K";

        if (request.size) {
            if (request.size.includes(":")) {
                // Direct aspect ratio string (e.g. "16:9")
                aspectRatio = request.size;
            } else if (request.size.includes("x")) {
                // Legacy pixel resolution string (e.g. "1024x1024")
                if (request.size.includes("1024x1024")) aspectRatio = "1:1";
                else if (request.size.includes("1536x1024") || request.size.includes("1248x832") || request.size.includes("1376x768")) aspectRatio = "3:2";
                else if (request.size.includes("1024x1536") || request.size.includes("832x1248") || request.size.includes("768x1376")) aspectRatio = "2:3";
            }
        }

        // Map quality to imageSize (resolution) if needed, or just use it if Gemini supports it
        // According to docs, imageSize is 1K, 2K, 4K
        if (request.quality === "2K") imageSize = "2K";
        else if (request.quality === "4K") imageSize = "4K";

        // Use the Gemini SDK for native image generation
        const model = this.client.getGenerativeModel({
            model: request.model,
        });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: request.prompt }] }],
            generationConfig: {
                // @ts-ignore
                responseModalities: ["IMAGE"],
                // @ts-ignore
                imageConfig: {
                    aspectRatio,
                    imageSize,
                },
                // @ts-ignore
                candidateCount: request.n || 1,
            }
        });

        const response = result.response;
        const parts = response.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
            // @ts-ignore
            if (part.inlineData) {
                // @ts-ignore
                const mimeType = part.inlineData.mimeType || "image/png";
                // @ts-ignore
                const base64Data = part.inlineData.data;
                const mediaUrl = `data:${mimeType};base64,${base64Data}`;

                return {
                    mediaUrl,
                    mediaType: "image",
                    metadata: {
                        model: request.model,
                        prompt: request.prompt,
                        aspectRatio,
                        imageSize,
                    },
                };
            }
        }

        throw new Error("No image data in response");
    }

    //* Generate video using Veo
    async generateVideo(request: VideoGenerationRequest): Promise<MediaResponse> {
        const isVeo = request.model.includes("veo");

        if (!isVeo) {
            throw new Error(`Model ${request.model} is not a video generation model`);
        }

        // Veo uses the predictLongRunning endpoint
        const baseUrl = "https://generativelanguage.googleapis.com/v1beta";
        const endpoint = `${baseUrl}/models/${request.model}:predictLongRunning?key=${this.apiKey}`;

        // Start the video generation
        const startResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                instances: [{
                    prompt: request.prompt,
                }],
                parameters: {
                    aspectRatio: (() => {
                        const ar = request.aspectRatio || "16:9";
                        if (ar === "1280x720") return "16:9";
                        if (ar === "720x1280") return "9:16";
                        return ar;
                    })(),
                    resolution: request.resolution || "720p",
                    durationSeconds: request.duration || 4,
                    sampleCount: 1,
                },
            }),
        });

        if (!startResponse.ok) {
            const error = await startResponse.text();
            throw new Error(`Failed to start video generation: ${error}`);
        }

        const operationData = await startResponse.json();
        const operationName = operationData.name;

        if (!operationName) {
            throw new Error("No operation name returned");
        }

        // Poll for completion
        const pollEndpoint = `${baseUrl}/${operationName}?key=${this.apiKey}`;
        const maxAttempts = 120; // Max 10 minutes (5s * 120)
        const pollInterval = 5000; // 5 seconds

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            const pollResponse = await fetch(pollEndpoint);

            if (!pollResponse.ok) {
                continue;
            }

            const pollData = await pollResponse.json();

            if (pollData.done) {
                // Check for errors
                if (pollData.error) {
                    throw new Error(`Video generation failed: ${pollData.error.message}`);
                }

                // Extract video URL from response
                const videos = pollData.response?.predictions?.[0]?.video;

                if (videos) {
                    // Response contains base64 video data
                    const mediaUrl = `data:video/mp4;base64,${videos}`;
                    return {
                        mediaUrl,
                        mediaType: "video",
                        metadata: {
                            model: request.model,
                            prompt: request.prompt,
                            duration: request.duration,
                            operationName,
                        },
                    };
                }

                // Check for GCS URI
                const gcsUri = pollData.response?.predictions?.[0]?.gcsUri;
                if (gcsUri) {
                    return {
                        mediaUrl: gcsUri,
                        mediaType: "video",
                        metadata: {
                            model: request.model,
                            prompt: request.prompt,
                            isGcsUri: true,
                            operationName,
                        },
                    };
                }

                throw new Error("No video data in response");
            }
        }

        throw new Error("Video generation timed out after 10 minutes");
    }
}
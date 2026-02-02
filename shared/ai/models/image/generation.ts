/**
 * Image Generation Models
 *
 * All models specialized in creating images from text prompts,
 * image editing, and visual content generation.
 *
 * Includes models from: OpenAI, Google
 *
 * @capability image.generation, image.editing
 * @date 2026-01-25
 */

import { SpecializedModel } from "@/types/AiModel";

export const IMAGE_GENERATION_MODELS: SpecializedModel[] = [
    // ========================================================================
    // OPENAI GPT IMAGE - Image Generation Models
    // ========================================================================

    //* GPT Image 1.5
    {
        id: "gpt-image-1.5",
        category: "image",
        provider: "GPT",
        providerModelId: "gpt-image-1.5",
        name: "GPT Image 1.5",
        description: "State-of-the-art image generation model with better instruction following and adherence to prompts",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gpt-claro.svg",
            dark: "/icons/gpt-oscuro.svg",
        },
        providerMetadata: {
            provider: "GPT",
            metadata: {
                contextWindow: 0,
                maxOutputTokens: 0,
                inputModalities: ["text", "image"],
                outputModalities: ["image", "text"],
                endpoints: {
                    chatCompletions: true,
                    responses: true,
                    realtime: true,
                    assistants: true,
                    batch: true,
                    fineTuning: false,
                    embeddings: false,
                    imageGeneration: true,
                    videos: false,
                    imageEdit: true,
                    speechGeneration: false,
                    transcription: false,
                    translation: false,
                    moderation: false,
                },
                features: {
                    streaming: false,
                    functionCalling: false,
                    structuredOutputs: false,
                    fineTuning: false,
                    distillation: false,
                },
                snapshots: ["gpt-image-1.5", "gpt-image-1.5-2025-12-16"],
                pricing: {
                    inputPerMillion: 5.00,
                    cachedInputPerMillion: 1.25,
                    outputPerMillion: 10.00,
                    imageGenerationPerImage: {
                        Low: {
                            "1024x1024": 0.009,
                            "1024x1536": 0.013,
                            "1536x1024": 0.013,
                        },
                        Medium: {
                            "1024x1024": 0.034,
                            "1024x1536": 0.05,
                            "1536x1024": 0.05,
                        },
                        High: {
                            "1024x1024": 0.133,
                            "1024x1536": 0.20,
                            "1536x1024": 0.20,
                        },
                    },
                },
                imageGenerationOptions: {
                    modelType: "gpt-image",
                    sizes: ["1024x1024", "1024x1536", "1536x1024"],
                    quality: ["low", "medium", "high", "auto"],
                    background: ["transparent", "opaque", "auto"],
                    output_format: ["png", "jpeg", "webp"],
                    n: [1, 2, 3, 4],
                    moderation: ["low", "auto"],
                },
            },
        },
        metadata: {
            qualityResolutions: ["Low", "Medium", "High"],
            aspectRatios: ["1024x1024", "1024x1536", "1536x1024"],
            supportedFormats: ["png", "jpg"],
        },
    },

    //* GPT Image 1
    {
        id: "gpt-image-1",
        category: "image",
        provider: "GPT",
        providerModelId: "gpt-image-1",
        name: "GPT Image 1",
        description: "Previous image generation model with higher quality but slower speed",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gpt-claro.svg",
            dark: "/icons/gpt-oscuro.svg",
        },
        providerMetadata: {
            provider: "GPT",
            metadata: {
                contextWindow: 0,
                maxOutputTokens: 0,
                inputModalities: ["text", "image"],
                outputModalities: ["image"],
                endpoints: {
                    chatCompletions: true,
                    responses: true,
                    realtime: true,
                    assistants: true,
                    batch: true,
                    fineTuning: false,
                    embeddings: false,
                    imageGeneration: true,
                    videos: false,
                    imageEdit: true,
                    speechGeneration: false,
                    transcription: false,
                    translation: false,
                    moderation: false,
                },
                features: {
                    streaming: false,
                    functionCalling: false,
                    structuredOutputs: false,
                    fineTuning: false,
                    distillation: false,
                },
                snapshots: ["gpt-image-1"],
                pricing: {
                    inputPerMillion: 5.00,
                    cachedInputPerMillion: 1.25,
                    outputPerMillion: 40.00,
                    imageGenerationPerImage: {
                        Low: {
                            "1024x1024": 0.011,
                            "1024x1536": 0.016,
                            "1536x1024": 0.016,
                        },
                        Medium: {
                            "1024x1024": 0.042,
                            "1024x1536": 0.063,
                            "1536x1024": 0.063,
                        },
                        High: {
                            "1024x1024": 0.167,
                            "1024x1536": 0.25,
                            "1536x1024": 0.25,
                        },
                    },
                },
                imageGenerationOptions: {
                    modelType: "gpt-image",
                    sizes: ["1024x1024", "1024x1536", "1536x1024"],
                    quality: ["low", "medium", "high", "auto"],
                    background: ["transparent", "opaque", "auto"],
                    output_format: ["png", "jpeg", "webp"],
                    n: [1, 2, 3, 4],
                    moderation: ["low", "auto"],
                },
            },
        },
        metadata: {
            qualityResolutions: ["Low", "Medium", "High"],
            aspectRatios: ["1024x1024", "1024x1536", "1536x1024"],
            supportedFormats: ["png", "jpg"],
        },
    },

    //* GPT Image 1 Mini
    {
        id: "gpt-image-1-mini",
        category: "image",
        provider: "GPT",
        providerModelId: "gpt-image-1-mini",
        name: "GPT Image 1 Mini",
        description: "Cost-efficient version of GPT Image 1 with lower pricing",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gpt-claro.svg",
            dark: "/icons/gpt-oscuro.svg",
        },
        providerMetadata: {
            provider: "GPT",
            metadata: {
                contextWindow: 0,
                maxOutputTokens: 0,
                inputModalities: ["text", "image"],
                outputModalities: ["image"],
                endpoints: {
                    chatCompletions: true,
                    responses: true,
                    realtime: true,
                    assistants: true,
                    batch: true,
                    fineTuning: false,
                    embeddings: false,
                    imageGeneration: true,
                    videos: false,
                    imageEdit: true,
                    speechGeneration: false,
                    transcription: false,
                    translation: false,
                    moderation: false,
                },
                features: {
                    streaming: false,
                    functionCalling: false,
                    structuredOutputs: false,
                    fineTuning: false,
                    distillation: false,
                },
                snapshots: ["gpt-image-1-mini"],
                pricing: {
                    inputPerMillion: 2.00,
                    cachedInputPerMillion: 0.20,
                    outputPerMillion: 8.00,
                    imageGenerationPerImage: {
                        Low: {
                            "1024x1024": 0.005,
                            "1024x1536": 0.006,
                            "1536x1024": 0.006,
                        },
                        Medium: {
                            "1024x1024": 0.011,
                            "1024x1536": 0.015,
                            "1536x1024": 0.015,
                        },
                        High: {
                            "1024x1024": 0.036,
                            "1024x1536": 0.052,
                            "1536x1024": 0.052,
                        },
                    },
                },
                imageGenerationOptions: {
                    modelType: "gpt-image",
                    sizes: ["1024x1024", "1024x1536", "1536x1024"],
                    quality: ["low", "medium", "high", "auto"],
                    background: ["transparent", "opaque", "auto"],
                    output_format: ["png", "jpeg", "webp"],
                    n: [1, 2, 3, 4],
                    moderation: ["low", "auto"],
                },
            },
        },
        metadata: {
            qualityResolutions: ["Low", "Medium", "High"],
            aspectRatios: ["1024x1024", "1024x1536", "1536x1024"],
            supportedFormats: ["png", "jpg"],
        },
    },

    // ========================================================================
    // GOOGLE GEMINI - Image Generation Models
    // ========================================================================

    //* Gemini 3 Pro Image Preview (Nano Banana Pro)
    {
        id: "gemini-3-pro-image-preview",
        category: "image",
        provider: "Gemini",
        providerModelId: "gemini-3-pro-image-preview",
        name: "Nano Banana Pro",
        description: "Professional asset production with advanced reasoning and up to 4K resolution",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gemini.svg",
            dark: "/icons/gemini.svg",
        },
        providerMetadata: {
            provider: "Gemini",
            metadata: {
                contextWindow: 65536,
                maxOutputTokens: 32768,
                knowledgeCutoff: "January 2025",
                latestUpdate: "November 2025",
                inputModalities: ["image", "text"],
                outputModalities: ["image", "text"],
                capabilities: {
                    audioGeneration: false,
                    imageGeneration: true,
                    videoGeneration: false,
                    batchAPI: true,
                    caching: false,
                    liveAPI: false,
                    thinking: true,
                    structuredOutputs: true,
                },
                tools: {
                    googleSearch: true,
                    googleMaps: false,
                    codeExecution: false,
                    urlContext: false,
                    computerUse: false,
                    fileSearch: false,
                    functionCalling: false,
                },
                agents: {
                    deepResearch: false,
                },
                imageGenerationOptions: {
                    modelType: "gemini",
                    sizes: ["1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "21:9"],
                    quality: ["1K", "2K", "4K"],
                    n: [1, 2, 3, 4],
                    modelName: "Nano Banana Pro",
                    supportsTextGeneration: true,
                    resolutionTiers: ["1K", "2K", "4K"],
                    aspectRatios: [
                        { ratio: "1:1", resolution: "1024x1024", tokens: 1120 },
                        { ratio: "1:1", resolution: "2048x2048", tokens: 1120 },
                        { ratio: "1:1", resolution: "4096x4096", tokens: 2000 },
                        { ratio: "16:9", resolution: "1376x768", tokens: 1120 },
                        { ratio: "16:9", resolution: "2752x1536", tokens: 1120 },
                        { ratio: "16:9", resolution: "5504x3072", tokens: 2000 },
                        { ratio: "9:16", resolution: "768x1376", tokens: 1120 },
                        { ratio: "9:16", resolution: "1536x2752", tokens: 1120 },
                        { ratio: "9:16", resolution: "3072x5504", tokens: 2000 },
                    ],
                },
            },
        },
    },

    //* Gemini 2.5 Flash Image (Nano Banana)
    {
        id: "gemini-2.5-flash-image",
        category: "image",
        provider: "Gemini",
        providerModelId: "gemini-2.5-flash-image",
        name: "Nano Banana",
        description: "Fast image generation optimized for high-volume, low-latency tasks",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gemini.svg",
            dark: "/icons/gemini.svg",
        },
        providerMetadata: {
            provider: "Gemini",
            metadata: {
                contextWindow: 65536,
                maxOutputTokens: 32768,
                inputModalities: ["image", "text"],
                outputModalities: ["image", "text"],
                capabilities: {
                    audioGeneration: false,
                    imageGeneration: true,
                    videoGeneration: false,
                    batchAPI: true,
                    caching: false,
                    liveAPI: false,
                    thinking: true,
                    structuredOutputs: true,
                },
                tools: {
                    googleSearch: true,
                    googleMaps: false,
                    codeExecution: false,
                    urlContext: false,
                    computerUse: false,
                    fileSearch: false,
                    functionCalling: false,
                },
                agents: {
                    deepResearch: false,
                },
                imageGenerationOptions: {
                    modelType: "gemini",
                    sizes: ["1:1", "2:3", "3:2", "16:9", "9:16", "21:9"],
                    quality: ["1K", "2K", "4K"],
                    n: [1, 2, 3, 4],
                    modelName: "Nano Banana",
                    supportsTextGeneration: true,
                    aspectRatios: [
                        { ratio: "1:1", resolution: "1024x1024", tokens: 1290 },
                        { ratio: "2:3", resolution: "832x1248", tokens: 1290 },
                        { ratio: "3:2", resolution: "1248x832", tokens: 1290 },
                        { ratio: "16:9", resolution: "1344x768", tokens: 1290 },
                        { ratio: "9:16", resolution: "768x1344", tokens: 1290 },
                        { ratio: "21:9", resolution: "1536x672", tokens: 1290 },
                    ],
                },
            },
        },
    },
];

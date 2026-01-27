/**
 * Video Generation Models
 *
 * All models specialized in creating videos from text prompts,
 * images, and other video content.
 *
 * Includes models from: OpenAI, Google
 *
 * @capability video.generation
 * @date 2026-01-25
 */

import { SpecializedModel } from "@/types/AiModel";

export const VIDEO_GENERATION_MODELS: SpecializedModel[] = [
    // ========================================================================
    // OPENAI SORA - Video Generation Models
    // ========================================================================

    //* Sora 2
    {
        id: "sora-2",
        category: "video",
        provider: "GPT",
        providerModelId: "sora-2",
        name: "Sora 2",
        description: "Flagship video generation with synced audio - richly detailed, dynamic clips from text or images",
        premium: true,
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
                knowledgeCutoff: "May 31, 2024",
                inputModalities: ["text", "image"],
                outputModalities: ["video", "audio"],
                endpoints: {
                    chatCompletions: false,
                    responses: false,
                    realtime: false,
                    assistants: false,
                    batch: true,
                    fineTuning: false,
                    embeddings: false,
                    imageGeneration: false,
                    videos: true,
                    imageEdit: false,
                    speechGeneration: false,
                    transcription: false,
                    translation: false,
                    moderation: false,
                },
                snapshots: ["sora-2", "sora-2-2025-10-06", "sora-2-2025-12-08"],
                pricing: {
                    inputPerMillion: 0,
                    outputPerMillion: 0,
                    videoGenerationPerSecond: 0.10,
                },
                videoGenerationOptions: {
                    aspectRatios: ["720x1280", "1280x720"],
                    resolutions: ["720p"],
                    maxDuration: 60,
                    audioGeneration: true,
                    snapshots: ["sora-2", "sora-2-2025-10-06", "sora-2-2025-12-08"],
                },
            },
        },
        metadata: {
            aspectRatios: ["720x1280", "1280x720"],
            maxDuration: 60,
            supportedFormats: ["mp4"],
        },
    },

    //* Sora 2 Pro
    {
        id: "sora-2-pro",
        category: "video",
        provider: "GPT",
        providerModelId: "sora-2-pro",
        name: "Sora 2 Pro",
        description: "Most advanced synced-audio video generation - state-of-the-art quality with higher resolutions",
        premium: true,
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
                outputModalities: ["video", "audio"],
                endpoints: {
                    chatCompletions: false,
                    responses: false,
                    realtime: false,
                    assistants: false,
                    batch: false,
                    fineTuning: false,
                    embeddings: false,
                    imageGeneration: false,
                    videos: true,
                    imageEdit: false,
                    speechGeneration: false,
                    transcription: false,
                    translation: false,
                    moderation: false,
                },
                snapshots: ["sora-2-pro", "sora-2-pro-2025-10-06"],
                pricing: {
                    inputPerMillion: 0,
                    outputPerMillion: 0,
                    videoGenerationPerSecond: {
                        "720p": 0.30,
                        "1080p": 0.50,
                    },
                },
                videoGenerationOptions: {
                    aspectRatios: ["720x1280", "1280x720", "1024x1792", "1792x1024"],
                    resolutions: ["720p", "1080p"],
                    maxDuration: 60,
                    audioGeneration: true,
                    snapshots: ["sora-2-pro", "sora-2-pro-2025-10-06"],
                },
            },
        },
        metadata: {
            aspectRatios: ["720x1280", "1280x720", "1024x1792", "1792x1024"],
            maxDuration: 60,
            supportedFormats: ["mp4"],
        },
    },

    // ========================================================================
    // GOOGLE VEO - Video Generation Models
    // ========================================================================

    //* VEO 3.1 Generate Preview
    {
        id: "veo-3.1-generate-preview",
        category: "video",
        provider: "Gemini",
        providerModelId: "veo-3.1-generate-preview",
        name: "Veo 3.1",
        description: "State-of-the-art video generation with reference images support",
        premium: true,
        enabled: true,
        icon: {
            light: "/icons/gemini.svg",
            dark: "/icons/gemini.svg",
        },
        providerMetadata: {
            provider: "Gemini",
            metadata: {
                contextWindow: 0,
                maxOutputTokens: 0,
                inputModalities: ["text", "image", "video"],
                outputModalities: ["video"],
                capabilities: {
                    audioGeneration: false,
                    imageGeneration: false,
                    videoGeneration: true,
                    batchAPI: false,
                    caching: false,
                    liveAPI: false,
                    thinking: false,
                    structuredOutputs: false,
                },
                tools: {
                    googleSearch: false,
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
                videoGenerationOptions: {
                    modelName: "Veo 3.1",
                    aspectRatios: ["16:9", "9:16"],
                    resolutions: ["720p", "1080p"],
                    durationSeconds: [4, 6, 8],
                    features: {
                        textToVideo: true,
                        imageToVideo: true,
                        videoExtension: true,
                        interpolation: true,
                        referenceImages: true,
                        audioCues: true,
                        negativePrompt: true,
                    },
                    personGeneration: ["allow_adult"],
                },
            },
        },
        metadata: {
            qualityResolutions: ["720p", "1080p"],
            aspectRatios: ["16:9", "9:16"],
            maxDuration: 8,
            supportedFormats: ["mp4", "webm"],
        },
    },

    //* VEO 3.1 Fast Generate Preview
    {
        id: "veo-3.1-fast-generate-preview",
        category: "video",
        provider: "Gemini",
        providerModelId: "veo-3.1-fast-generate-preview",
        name: "Veo 3.1 Fast",
        description: "Fast video generation with all Veo 3.1 features",
        premium: true,
        enabled: true,
        icon: {
            light: "/icons/gemini.svg",
            dark: "/icons/gemini.svg",
        },
        providerMetadata: {
            provider: "Gemini",
            metadata: {
                contextWindow: 0,
                maxOutputTokens: 0,
                inputModalities: ["text", "image", "video"],
                outputModalities: ["video"],
                capabilities: {
                    audioGeneration: false,
                    imageGeneration: false,
                    videoGeneration: true,
                    batchAPI: false,
                    caching: false,
                    liveAPI: false,
                    thinking: false,
                    structuredOutputs: false,
                },
                tools: {
                    googleSearch: false,
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
                videoGenerationOptions: {
                    modelName: "Veo 3.1 Fast",
                    aspectRatios: ["16:9", "9:16"],
                    resolutions: ["720p", "1080p"],
                    durationSeconds: [4, 6, 8],
                    features: {
                        textToVideo: true,
                        imageToVideo: true,
                        videoExtension: true,
                        interpolation: true,
                        referenceImages: true,
                        audioCues: true,
                        negativePrompt: true,
                    },
                    personGeneration: ["allow_adult"],
                },
            },
        },
        metadata: {
            qualityResolutions: ["720p", "1080p"],
            aspectRatios: ["16:9", "9:16"],
            maxDuration: 8,
            supportedFormats: ["mp4", "webm"],
        },
    },
];

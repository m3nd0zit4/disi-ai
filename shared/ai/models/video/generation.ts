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

    //* Sora 2 | Text-to-Video
    {
        id: "sora-2-text-to-video",
        category: "video",
        provider: "GPT",
        providerModelId: "sora-2",
        name: "Sora 2 | Text-to-Video",
        description: "Fast video generation from text prompts with synced audio",
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
                inputModalities: ["text"],
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
                pricing: {
                    inputPerMillion: 0,
                    outputPerMillion: 0,
                    videoGenerationPerSecond: 0.10,
                },
                videoGenerationOptions: {
                    aspectRatios: ["720x1280", "1280x720"],
                    resolutions: ["720p"],
                    maxDuration: 12,
                    durationSeconds: [4, 8, 12],
                    audioGeneration: true,
                },
            },
        },
        metadata: {
            aspectRatios: ["720x1280", "1280x720"],
            maxDuration: 12,
            supportedFormats: ["mp4"],
        },
    },

    //* Sora 2 | Image-to-Video
    {
        id: "sora-2-image-to-video",
        category: "video",
        provider: "GPT",
        providerModelId: "sora-2",
        name: "Sora 2 | Image-to-Video",
        description: "Animate images into dynamic video clips with synced audio",
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
                inputModalities: ["image", "text"],
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
                pricing: {
                    inputPerMillion: 0,
                    outputPerMillion: 0,
                    videoGenerationPerSecond: 0.15,
                },
                videoGenerationOptions: {
                    aspectRatios: ["720x1280", "1280x720"],
                    resolutions: ["720p"],
                    maxDuration: 12,
                    durationSeconds: [4, 8, 12],
                    audioGeneration: true,
                },
            },
        },
        metadata: {
            aspectRatios: ["720x1280", "1280x720"],
            maxDuration: 12,
            supportedFormats: ["mp4"],
        },
    },

    //* Sora 2 Pro | Text-to-Video
    {
        id: "sora-2-pro-text-to-video",
        category: "video",
        provider: "GPT",
        providerModelId: "sora-2-pro",
        name: "Sora 2 Pro | Text-to-Video",
        description: "Production-quality video generation from text with high resolution",
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
                inputModalities: ["text"],
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
                pricing: {
                    inputPerMillion: 0,
                    outputPerMillion: 0,
                    videoGenerationPerSecond: 0.25,
                },
                videoGenerationOptions: {
                    aspectRatios: ["720x1280", "1280x720", "1024x1792", "1792x1024"],
                    resolutions: ["720p", "1080p"],
                    maxDuration: 12,
                    durationSeconds: [4, 8, 12],
                    audioGeneration: true,
                },
            },
        },
        metadata: {
            aspectRatios: ["720x1280", "1280x720", "1024x1792", "1792x1024"],
            maxDuration: 12,
            supportedFormats: ["mp4"],
        },
    },

    //* Sora 2 Pro | Image-to-Video
    {
        id: "sora-2-pro-image-to-video",
        category: "video",
        provider: "GPT",
        providerModelId: "sora-2-pro",
        name: "Sora 2 Pro | Image-to-Video",
        description: "High-fidelity image animation with professional results",
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
                inputModalities: ["image", "text"],
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
                pricing: {
                    inputPerMillion: 0,
                    outputPerMillion: 0,
                    videoGenerationPerSecond: 0.35,
                },
                videoGenerationOptions: {
                    aspectRatios: ["720x1280", "1280x720", "1024x1792", "1792x1024"],
                    resolutions: ["720p", "1080p"],
                    maxDuration: 12,
                    durationSeconds: [4, 8, 12],
                    audioGeneration: true,
                },
            },
        },
        metadata: {
            aspectRatios: ["720x1280", "1280x720", "1024x1792", "1792x1024"],
            maxDuration: 12,
            supportedFormats: ["mp4"],
        },
    },

    // ========================================================================
    // GOOGLE VEO - Video Generation Models
    // ========================================================================

    //* Veo 3.1 | Text-to-Video
    {
        id: "veo-3.1-text-to-video",
        category: "video",
        provider: "Gemini",
        providerModelId: "veo-3.1-generate-preview",
        name: "Veo 3.1 | Text-to-Video",
        description: "State-of-the-art video generation from text prompts",
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
                inputModalities: ["text"],
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
                    resolutions: ["720p", "1080p", "4k"],
                    durationSeconds: [4, 6, 8],
                    features: {
                        textToVideo: true,
                        imageToVideo: false,
                        videoExtension: false,
                        interpolation: false,
                        referenceImages: false,
                        audioCues: true,
                        negativePrompt: true,
                    },
                    personGeneration: ["allow_adult"],
                },
            },
        },
        metadata: {
            qualityResolutions: ["720p", "1080p", "4k"],
            aspectRatios: ["16:9", "9:16"],
            maxDuration: 8,
            supportedFormats: ["mp4"],
        },
    },

    //* Veo 3.1 | Image-to-Video
    {
        id: "veo-3.1-image-to-video",
        category: "video",
        provider: "Gemini",
        providerModelId: "veo-3.1-generate-preview",
        name: "Veo 3.1 | Image-to-Video",
        description: "Animate images with stunning realism and cinematic style",
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
                inputModalities: ["image", "text"],
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
                    resolutions: ["720p", "1080p", "4k"],
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
            qualityResolutions: ["720p", "1080p", "4k"],
            aspectRatios: ["16:9", "9:16"],
            maxDuration: 8,
            supportedFormats: ["mp4"],
        },
    },

    //* Veo 3.1 Fast | Text-to-Video
    {
        id: "veo-3.1-fast-text-to-video",
        category: "video",
        provider: "Gemini",
        providerModelId: "veo-3.1-fast-generate-preview",
        name: "Veo 3.1 Fast | Text-to-Video",
        description: "Fast video generation from text prompts",
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
                inputModalities: ["text"],
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
                    resolutions: ["720p", "1080p", "4k"],
                    durationSeconds: [4, 6, 8],
                    features: {
                        textToVideo: true,
                        imageToVideo: false,
                        videoExtension: false,
                        interpolation: false,
                        referenceImages: false,
                        audioCues: true,
                        negativePrompt: true,
                    },
                    personGeneration: ["allow_adult"],
                },
            },
        },
        metadata: {
            qualityResolutions: ["720p", "1080p", "4k"],
            aspectRatios: ["16:9", "9:16"],
            maxDuration: 8,
            supportedFormats: ["mp4"],
        },
    },

    //* Veo 3.1 Fast | Image-to-Video
    {
        id: "veo-3.1-fast-image-to-video",
        category: "video",
        provider: "Gemini",
        providerModelId: "veo-3.1-fast-generate-preview",
        name: "Veo 3.1 Fast | Image-to-Video",
        description: "Fast image animation with Veo 3.1 capabilities",
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
                inputModalities: ["image", "text"],
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
                    resolutions: ["720p", "1080p", "4k"],
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
            qualityResolutions: ["720p", "1080p", "4k"],
            aspectRatios: ["16:9", "9:16"],
            maxDuration: 8,
            supportedFormats: ["mp4"],
        },
    },
];

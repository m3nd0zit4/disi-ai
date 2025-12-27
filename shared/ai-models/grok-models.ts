import { SpecializedModel } from "@/types/AiModel";

export const GROK_MODELS: SpecializedModel[] = [
    // ========================================================================
    // 4. XAI GROK
    // ========================================================================
    
    //* Grok 4.1 Fast Reasoning
    {
        id: "grok-4-1-fast-reasoning",
        category: "reasoning",
        provider: "Grok",
        providerModelId: "grok-4-1-fast-reasoning",
        name: "Grok 4.1 Fast Reasoning",
        description: "Fast reasoning model with 2M context window",
        premium: true,
        enabled: true,
        icon: {
            light: "/icons/grok-claro.svg",
            dark: "/icons/grok-oscuro.svg",
        },
        providerMetadata: {
            provider: "Grok",
            metadata: {
                contextWindow: 2000000,
                maxOutputTokens: 128000, // Assuming standard max output for now, not specified in image but usually high for reasoning
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    functionCalling: true,
                    twitterAccess: true,
                },
                tools: {
                    webSearch: true,
                    xSearch: true,
                    codeExecution: true,
                    imageUnderstanding: true,
                    collectionsSearch: true,
                    mcp: true,
                    documentSearch: true,
                },
                pricing: {
                    inputPerMillion: 0.20,
                    cachedInputPerMillion: 0.05,
                    outputPerMillion: 0.50,
                }
            },
        },
    },

    //* Grok 4.1 Fast Non-Reasoning
    {
        id: "grok-4-1-fast-non-reasoning",
        category: "reasoning",
        provider: "Grok",
        providerModelId: "grok-4-1-fast-non-reasoning",
        name: "Grok 4.1 Fast",
        description: "Fast standard model with 2M context window",
        premium: true,
        enabled: true,
        icon: {
            light: "/icons/grok-claro.svg",
            dark: "/icons/grok-oscuro.svg",
        },
        providerMetadata: {
            provider: "Grok",
            metadata: {
                contextWindow: 2000000,
                maxOutputTokens: 128000,
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    functionCalling: true,
                    twitterAccess: true,
                },
                tools: {
                    webSearch: true,
                    xSearch: true,
                    codeExecution: true,
                    imageUnderstanding: true,
                    collectionsSearch: true,
                    mcp: true,
                    documentSearch: true,
                },
                pricing: {
                    inputPerMillion: 0.20,
                    cachedInputPerMillion: 0.05,
                    outputPerMillion: 0.50,
                }
            },
        },
    },

    //* Grok 4 Fast Reasoning
    {
        id: "grok-4-fast-reasoning",
        category: "reasoning",
        provider: "Grok",
        providerModelId: "grok-4-fast-reasoning",
        name: "Grok 4 Fast Reasoning",
        description: "Previous generation fast reasoning model",
        premium: true,
        enabled: true,
        icon: {
            light: "/icons/grok-claro.svg",
            dark: "/icons/grok-oscuro.svg",
        },
        providerMetadata: {
            provider: "Grok",
            metadata: {
                contextWindow: 2000000,
                maxOutputTokens: 128000,
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    functionCalling: true,
                    twitterAccess: true,
                },
                tools: {
                    webSearch: true,
                    xSearch: true,
                    codeExecution: true,
                    imageUnderstanding: true,
                    collectionsSearch: true,
                    mcp: true,
                    documentSearch: true,
                },
                pricing: {
                    inputPerMillion: 0.20,
                    cachedInputPerMillion: 0.05,
                    outputPerMillion: 0.50,
                }
            },
        },
    },

    //* Grok 4 Fast Non-Reasoning
    {
        id: "grok-4-fast-non-reasoning",
        category: "reasoning",
        provider: "Grok",
        providerModelId: "grok-4-fast-non-reasoning",
        name: "Grok 4 Fast",
        description: "Previous generation fast standard model",
        premium: true,
        enabled: true,
        icon: {
            light: "/icons/grok-claro.svg",
            dark: "/icons/grok-oscuro.svg",
        },
        providerMetadata: {
            provider: "Grok",
            metadata: {
                contextWindow: 2000000,
                maxOutputTokens: 128000,
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    functionCalling: true,
                    twitterAccess: true,
                },
                tools: {
                    webSearch: true,
                    xSearch: true,
                    codeExecution: true,
                    imageUnderstanding: true,
                    collectionsSearch: true,
                    mcp: true,
                    documentSearch: true,
                },
                pricing: {
                    inputPerMillion: 0.20,
                    cachedInputPerMillion: 0.05,
                    outputPerMillion: 0.50,
                }
            },
        },
    },

    //* Grok 2 Image 1212
    {
        id: "grok-2-image-1212",
        category: "image",
        provider: "Grok",
        providerModelId: "grok-2-image-1212",
        name: "Grok 2 Image",
        description: "Image generation model from xAI",
        premium: true,
        enabled: true,
        icon: {
            light: "/icons/grok-claro.svg",
            dark: "/icons/grok-oscuro.svg",
        },
        providerMetadata: {
            provider: "Grok",
            metadata: {
                contextWindow: 32768, // Assuming standard context for image model if applicable, or 0
                maxOutputTokens: 4096,
                inputModalities: ["text"],
                outputModalities: ["image"],
                features: {
                    streaming: false,
                    functionCalling: false,
                    twitterAccess: false,
                },
                tools: {
                    webSearch: false,
                    xSearch: false,
                    codeExecution: false,
                    imageUnderstanding: false,
                    collectionsSearch: false,
                    mcp: false,
                    documentSearch: false,
                },
                pricing: {
                    inputPerMillion: 0,
                    outputPerMillion: 0,
                    imageGenerationPerImage: 0.07,
                },
                imageGenerationOptions: {
                    supportsTextGeneration: false,
                }
            },
        },
    },
];

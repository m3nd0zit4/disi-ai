import { SpecializedModel } from "@/types/AiModel";

export const DEEPSEEK_MODELS: SpecializedModel[] = [
    // ========================================================================
    // 5. DEEPSEEK
    // ========================================================================
    
    //* DeepSeek Chat (V3.2)
    {
        id: "deepseek-chat",
        category: "standard",
        provider: "DeepSeek",
        providerModelId: "deepseek-chat",
        name: "DeepSeek-V3.2",
        description: "DeepSeek-V3.2 (Non-thinking Mode) - General purpose model",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/deepseek.svg",
            dark: "/icons/deepseek.svg",
        },
        providerMetadata: {
            provider: "DeepSeek",
            metadata: {
                contextWindow: 128000,
                maxOutputTokens: 8000, // Maximum 8K
                inputModalities: ["text"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    functionCalling: true,
                    chatPrefixCompletion: true,
                    fimCompletion: true,
                },
                pricing: {
                    inputPerMillion: 0.28,
                    cachedInputPerMillion: 0.028,
                    outputPerMillion: 0.42,
                }
            },
        },
    },

    //* DeepSeek Reasoner (V3.2)
    {
        id: "deepseek-reasoner",
        category: "reasoning",
        provider: "DeepSeek",
        providerModelId: "deepseek-reasoner",
        name: "DeepSeek-V3.2 Reasoner",
        description: "DeepSeek-V3.2 (Thinking Mode) - Advanced reasoning model",
        premium: true,
        enabled: true,
        icon: {
            light: "/icons/deepseek.svg",
            dark: "/icons/deepseek.svg",
        },
        providerMetadata: {
            provider: "DeepSeek",
            metadata: {
                contextWindow: 128000,
                maxOutputTokens: 64000, // Maximum 64K
                inputModalities: ["text"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    functionCalling: true,
                    chatPrefixCompletion: true,
                    fimCompletion: false, // Not supported for reasoner
                },
                pricing: {
                    inputPerMillion: 0.28, // Assuming same pricing as chat if not specified otherwise, but usually reasoner is more expensive. Image implies same base pricing table applies.
                    cachedInputPerMillion: 0.028,
                    outputPerMillion: 0.42,
                }
            },
        },
    },
];

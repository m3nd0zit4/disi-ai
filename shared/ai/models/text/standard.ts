/**
 * Text Standard Models
 *
 * General purpose chat models for everyday conversations,
 * simpler tasks, and cost-efficient operations.
 *
 * Includes models from: Anthropic, xAI, DeepSeek
 *
 * @capability text.chat
 * @date 2026-01-25
 */

import { SpecializedModel } from "@/types/AiModel";

export const TEXT_STANDARD_MODELS: SpecializedModel[] = [
    // ========================================================================
    // ANTHROPIC CLAUDE - Standard Models
    // ========================================================================

    //* Claude 3 Haiku (Legacy, cost-efficient)
    {
        id: "claude-3-haiku",
        category: "standard",
        provider: "Claude",
        providerModelId: "claude-3-haiku-20240307",
        name: "Claude 3 Haiku",
        description: "Legacy fastest and most cost-effective model",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/claude.svg",
            dark: "/icons/claude.svg",
        },
        providerMetadata: {
            provider: "Claude",
            metadata: {
                contextWindow: 200000,
                maxOutputTokens: 4096,
                knowledgeCutoff: "August 2023",
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    systemPrompts: true,
                    functionCalling: true,
                    promptCaching: true,
                    extendedThinking: false,
                },
                pricing: {
                    inputPerMillion: 0.25,
                    outputPerMillion: 1.25,
                }
            },
        },
    },

    // ========================================================================
    // XAI GROK - Standard Models
    // ========================================================================

    //* Grok 3 Mini - Cost-efficient
    {
        id: "grok-3-mini",
        category: "standard",
        provider: "Grok",
        providerModelId: "grok-3-mini",
        name: "Grok 3 Mini",
        description: "Cost-efficient model for simpler tasks",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/grok-claro.svg",
            dark: "/icons/grok-oscuro.svg",
        },
        providerMetadata: {
            provider: "Grok",
            metadata: {
                contextWindow: 131072,
                maxOutputTokens: 16384,
                inputModalities: ["text"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    functionCalling: true,
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
                    inputPerMillion: 0.30,
                    cachedInputPerMillion: 0.03,
                    outputPerMillion: 0.50,
                }
            },
        },
    },

    // ========================================================================
    // DEEPSEEK - Standard Models
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
                maxOutputTokens: 8000,
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
];

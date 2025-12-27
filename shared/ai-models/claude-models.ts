import { SpecializedModel } from "@/types/AiModel";

export const CLAUDE_MODELS: SpecializedModel[] = [
    // ========================================================================
    // 3. ANTHROPIC CLAUDE
    // ========================================================================
    
    //* Claude Sonnet 4.5
    {
        id: "claude-sonnet-4-5",
        category: "reasoning",
        provider: "Claude",
        providerModelId: "claude-sonnet-4-5-20250929",
        name: "Claude Sonnet 4.5",
        description: "Our smart model for complex agents and coding",
        premium: true,
        enabled: true,
        icon: {
            light: "/icons/claude.svg",
            dark: "/icons/claude.svg",
        },
        providerMetadata: {
            provider: "Claude",
            metadata: {
                contextWindow: 200000,
                maxOutputTokens: 65536, // 64K
                knowledgeCutoff: "January 2025",
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    systemPrompts: true,
                    functionCalling: true,
                    promptCaching: true,
                    extendedThinking: true,
                },
                tools: {
                    computerUse: true,
                    textEditor: true,
                    webSearch: true,
                    webFetch: true,
                    mcp: true,
                    functionCalling: true,
                },
                pricing: {
                    inputPerMillion: 3.00,
                    outputPerMillion: 15.00,
                    cacheWritePerMillion: 3.75, // Assuming standard ratio if not specified, or keeping previous
                    cacheReadPerMillion: 0.30,
                }
            },
        },
    },

    //* Claude Haiku 4.5
    {
        id: "claude-haiku-4-5",
        category: "reasoning",
        provider: "Claude",
        providerModelId: "claude-haiku-4-5-20251001",
        name: "Claude Haiku 4.5",
        description: "Our fastest model with near-frontier intelligence",
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
                maxOutputTokens: 65536, // 64K
                knowledgeCutoff: "February 2025",
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    systemPrompts: true,
                    functionCalling: true,
                    promptCaching: true,
                    extendedThinking: true,
                },
                tools: {
                    computerUse: true,
                    textEditor: true,
                    webSearch: true,
                    webFetch: true,
                    mcp: true,
                    functionCalling: true,
                },
                pricing: {
                    inputPerMillion: 1.00,
                    outputPerMillion: 5.00,
                    cacheWritePerMillion: 1.25, // Estimated based on input
                    cacheReadPerMillion: 0.10,  // Estimated
                }
            },
        },
    },

    //* Claude Opus 4.5
    {
        id: "claude-opus-4-5",
        category: "reasoning",
        provider: "Claude",
        providerModelId: "claude-opus-4-5-20251101",
        name: "Claude Opus 4.5",
        description: "Premium model combining maximum intelligence with practical performance",
        premium: true,
        enabled: true,
        icon: {
            light: "/icons/claude.svg",
            dark: "/icons/claude.svg",
        },
        providerMetadata: {
            provider: "Claude",
            metadata: {
                contextWindow: 200000,
                maxOutputTokens: 65536, // 64K
                knowledgeCutoff: "May 2025",
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    systemPrompts: true,
                    functionCalling: true,
                    promptCaching: true,
                    extendedThinking: true,
                },
                tools: {
                    computerUse: true,
                    textEditor: true,
                    webSearch: true,
                    webFetch: true,
                    mcp: true,
                    functionCalling: true,
                },
                pricing: {
                    inputPerMillion: 5.00,
                    outputPerMillion: 25.00,
                    cacheWritePerMillion: 6.25, // Estimated
                    cacheReadPerMillion: 0.50,  // Estimated
                }
            },
        },
    },
];

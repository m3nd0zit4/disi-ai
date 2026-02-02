/**
 * Text Reasoning Models
 *
 * All models with advanced reasoning capabilities for complex tasks,
 * coding, analysis, and multi-step problem solving.
 *
 * Includes models from: Anthropic, OpenAI, Google, xAI, DeepSeek
 *
 * @capability text.reasoning, text.coding, text.chat
 * @date 2026-01-25
 */

import { SpecializedModel } from "@/types/AiModel";

export const TEXT_REASONING_MODELS: SpecializedModel[] = [
    // ========================================================================
    // ANTHROPIC CLAUDE - Reasoning Models
    // ========================================================================

    //* Claude Sonnet 4.5 - Smart model for complex agents and coding
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
                maxOutputTokens: 65536,
                knowledgeCutoff: "September 2025",
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
                    cacheWritePerMillion: 3.75,
                    cacheReadPerMillion: 0.30,
                }
            },
        },
    },

    //* Claude Haiku 4.5 - Fastest model with near-frontier intelligence
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
                maxOutputTokens: 65536,
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
                    cacheWritePerMillion: 1.25,
                    cacheReadPerMillion: 0.10,
                }
            },
        },
    },

    //* Claude Opus 4.5 - Premium model with maximum intelligence
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
                maxOutputTokens: 65536,
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
                    cacheWritePerMillion: 6.25,
                    cacheReadPerMillion: 0.50,
                }
            },
        },
    },

    //* Claude Opus 4.1 - Legacy high-performance
    {
        id: "claude-opus-4-1",
        category: "reasoning",
        provider: "Claude",
        providerModelId: "claude-opus-4-1-20250805",
        name: "Claude Opus 4.1",
        description: "Legacy high-performance model",
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
                maxOutputTokens: 32768,
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
                pricing: {
                    inputPerMillion: 15.00,
                    outputPerMillion: 75.00,
                }
            },
        },
    },

    //* Claude Sonnet 4 - Previous generation
    {
        id: "claude-sonnet-4",
        category: "reasoning",
        provider: "Claude",
        providerModelId: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        description: "Previous generation smart model",
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
                maxOutputTokens: 65536,
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
                pricing: {
                    inputPerMillion: 3.00,
                    outputPerMillion: 15.00,
                }
            },
        },
    },

    // ========================================================================
    // OPENAI GPT - Reasoning Models
    // ========================================================================

    //* GPT 5.2
    {
        id: "gpt-5.2",
        category: "reasoning",
        provider: "GPT",
        providerModelId: "gpt-5.2",
        name: "GPT-5.2",
        description: "The best model for coding and agentic tasks across industries",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gpt-claro.svg",
            dark: "/icons/gpt-oscuro.svg",
        },
        providerMetadata: {
            provider: "GPT",
            metadata: {
                contextWindow: 400000,
                maxOutputTokens: 128000,
                knowledgeCutoff: "Aug 31, 2025",
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                endpoints: {
                    chatCompletions: true,
                    responses: true,
                    realtime: false,
                    assistants: false,
                    batch: true,
                    fineTuning: false,
                    embeddings: false,
                    imageGeneration: false,
                    videos: false,
                    imageEdit: false,
                    speechGeneration: false,
                    transcription: false,
                    translation: false,
                    moderation: false,
                },
                features: {
                    streaming: true,
                    functionCalling: true,
                    structuredOutputs: true,
                    fineTuning: false,
                    distillation: true,
                },
                tools: {
                    webSearch: true,
                    fileSearch: true,
                    imageGeneration: false,
                    codeInterpreter: true,
                    computerUse: false,
                    mcp: true,
                },
                snapshots: ["gpt-5.2", "gpt-5.2-2025-12-11"],
                pricing: {
                    inputPerMillion: 1.75,
                    cachedInputPerMillion: 0.175,
                    outputPerMillion: 14.00,
                },
            },
        },
    },

    //* GPT 5.2 Pro
    {
        id: "gpt-5.2-pro",
        category: "reasoning",
        provider: "GPT",
        providerModelId: "gpt-5.2-pro",
        name: "GPT-5.2 Pro",
        description: "Version of GPT-5.2 that produces smarter and more precise responses.",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gpt-claro.svg",
            dark: "/icons/gpt-oscuro.svg",
        },
        providerMetadata: {
            provider: "GPT",
            metadata: {
                contextWindow: 400000,
                maxOutputTokens: 128000,
                knowledgeCutoff: "Aug 31, 2025",
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                endpoints: {
                    chatCompletions: false,
                    responses: true,
                    realtime: false,
                    assistants: false,
                    batch: false,
                    fineTuning: false,
                    embeddings: false,
                    imageGeneration: false,
                    videos: false,
                    imageEdit: false,
                    speechGeneration: false,
                    transcription: false,
                    translation: false,
                    moderation: false,
                },
                features: {
                    streaming: true,
                    functionCalling: true,
                    structuredOutputs: false,
                    fineTuning: false,
                    distillation: false,
                },
                tools: {
                    webSearch: true,
                    fileSearch: true,
                    imageGeneration: false,
                    codeInterpreter: false,
                    computerUse: false,
                    mcp: true,
                },
                snapshots: ["gpt-5.2-pro", "gpt-5.2-pro-2025-12-11"],
                pricing: {
                    inputPerMillion: 21.00,
                    outputPerMillion: 168.00,
                },
            },
        },
    },

    //* GPT 5
    {
        id: "gpt-5",
        category: "reasoning",
        provider: "GPT",
        providerModelId: "gpt-5",
        name: "GPT-5",
        description: "Previous intelligent reasoning model for coding and agentic tasks with configurable reasoning effort",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gpt-claro.svg",
            dark: "/icons/gpt-oscuro.svg",
        },
        providerMetadata: {
            provider: "GPT",
            metadata: {
                contextWindow: 400000,
                maxOutputTokens: 128000,
                knowledgeCutoff: "Sep 30, 2024",
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                endpoints: {
                    chatCompletions: true,
                    responses: true,
                    realtime: false,
                    assistants: false,
                    batch: true,
                    fineTuning: false,
                    embeddings: false,
                    imageGeneration: false,
                    videos: false,
                    imageEdit: false,
                    speechGeneration: false,
                    transcription: false,
                    translation: false,
                    moderation: false,
                },
                features: {
                    streaming: true,
                    functionCalling: true,
                    structuredOutputs: true,
                    fineTuning: false,
                    distillation: true,
                },
                tools: {
                    webSearch: true,
                    fileSearch: true,
                    imageGeneration: false,
                    codeInterpreter: true,
                    computerUse: false,
                    mcp: true,
                },
                snapshots: ["gpt-5", "gpt-5-2025-08-07"],
                pricing: {
                    inputPerMillion: 1.25,
                    cachedInputPerMillion: 0.125,
                    outputPerMillion: 10.00,
                },
            },
        },
    },

    //* GPT 5 Mini
    {
        id: "gpt-5-mini",
        category: "reasoning",
        provider: "GPT",
        providerModelId: "gpt-5-mini",
        name: "GPT-5 mini",
        description: "A faster, cost-efficient version of GPT-5 for well-defined tasks",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gpt-claro.svg",
            dark: "/icons/gpt-oscuro.svg",
        },
        providerMetadata: {
            provider: "GPT",
            metadata: {
                contextWindow: 400000,
                maxOutputTokens: 128000,
                knowledgeCutoff: "May 31, 2024",
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                endpoints: {
                    chatCompletions: true,
                    responses: true,
                    realtime: false,
                    assistants: false,
                    batch: true,
                    fineTuning: false,
                    embeddings: false,
                    imageGeneration: false,
                    videos: false,
                    imageEdit: false,
                    speechGeneration: false,
                    transcription: false,
                    translation: false,
                    moderation: false,
                },
                features: {
                    streaming: true,
                    functionCalling: true,
                    structuredOutputs: true,
                    fineTuning: false,
                    distillation: false,
                },
                tools: {
                    webSearch: true,
                    fileSearch: true,
                    imageGeneration: false,
                    codeInterpreter: true,
                    computerUse: false,
                    mcp: true,
                },
                snapshots: ["gpt-5-mini", "gpt-5-mini-2025-08-07"],
                pricing: {
                    inputPerMillion: 0.25,
                    cachedInputPerMillion: 0.025,
                    outputPerMillion: 2.00,
                },
            },
        },
    },

    //* GPT 5 Nano
    {
        id: "gpt-5-nano",
        category: "reasoning",
        provider: "GPT",
        providerModelId: "gpt-5-nano",
        name: "GPT-5 nano",
        description: "Fastest, most cost-efficient version of GPT-5",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gpt-claro.svg",
            dark: "/icons/gpt-oscuro.svg",
        },
        providerMetadata: {
            provider: "GPT",
            metadata: {
                contextWindow: 400000,
                maxOutputTokens: 128000,
                knowledgeCutoff: "May 31, 2024",
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                endpoints: {
                    chatCompletions: true,
                    responses: true,
                    realtime: false,
                    assistants: false,
                    batch: true,
                    fineTuning: false,
                    embeddings: false,
                    imageGeneration: false,
                    videos: false,
                    imageEdit: false,
                    speechGeneration: false,
                    transcription: false,
                    translation: false,
                    moderation: false,
                },
                features: {
                    streaming: true,
                    functionCalling: true,
                    structuredOutputs: true,
                    fineTuning: false,
                    distillation: false,
                },
                tools: {
                    webSearch: true,
                    fileSearch: true,
                    imageGeneration: false,
                    codeInterpreter: true,
                    computerUse: false,
                    mcp: true,
                },
                snapshots: ["gpt-5-nano", "gpt-5-nano-2025-08-07"],
                pricing: {
                    inputPerMillion: 0.05,
                    cachedInputPerMillion: 0.005,
                    outputPerMillion: 0.40,
                },
            },
        },
    },

    //* GPT 4.1
    {
        id: "gpt-4.1",
        category: "reasoning",
        provider: "GPT",
        providerModelId: "gpt-4.1",
        name: "GPT-4.1",
        description: "Smartest non-reasoning model",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gpt-claro.svg",
            dark: "/icons/gpt-oscuro.svg",
        },
        providerMetadata: {
            provider: "GPT",
            metadata: {
                contextWindow: 1047576,
                maxOutputTokens: 32768,
                knowledgeCutoff: "Jun 01, 2024",
                inputModalities: ["text", "image"],
                outputModalities: ["text"],
                endpoints: {
                    chatCompletions: true,
                    responses: true,
                    realtime: false,
                    assistants: true,
                    batch: true,
                    fineTuning: true,
                    embeddings: false,
                    imageGeneration: false,
                    videos: false,
                    imageEdit: false,
                    speechGeneration: false,
                    transcription: false,
                    translation: false,
                    moderation: false,
                },
                features: {
                    streaming: true,
                    functionCalling: true,
                    structuredOutputs: true,
                    fineTuning: true,
                    distillation: true,
                },
                tools: {
                    webSearch: true,
                    fileSearch: true,
                    imageGeneration: false,
                    codeInterpreter: true,
                    computerUse: false,
                    mcp: true,
                },
                snapshots: ["gpt-4.1", "gpt-4.1-2025-04-14"],
                pricing: {
                    inputPerMillion: 2.00,
                    cachedInputPerMillion: 0.50,
                    outputPerMillion: 8.00,
                },
            },
        },
    },

    // ========================================================================
    // GOOGLE GEMINI - Reasoning Models
    // ========================================================================

    //* Gemini 3 Pro Preview
    {
        id: "gemini-3-pro-preview",
        category: "reasoning",
        provider: "Gemini",
        providerModelId: "gemini-3-pro-preview",
        name: "Gemini 3 Pro",
        description: "Fast, frontier-class performance with upgraded visual and spatial reasoning",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gemini.svg",
            dark: "/icons/gemini.svg",
        },
        providerMetadata: {
            provider: "Gemini",
            metadata: {
                contextWindow: 1048576,
                maxOutputTokens: 64000,
                knowledgeCutoff: "January 2025",
                latestUpdate: "November 2025",
                inputModalities: ["text", "image", "video", "audio", "pdf"],
                outputModalities: ["text"],
                capabilities: {
                    audioGeneration: false,
                    imageGeneration: false,
                    videoGeneration: false,
                    batchAPI: true,
                    caching: true,
                    liveAPI: false,
                    thinking: true,
                    structuredOutputs: true,
                },
                tools: {
                    googleSearch: true,
                    googleMaps: false,
                    codeExecution: true,
                    urlContext: true,
                    computerUse: false,
                    fileSearch: true,
                    functionCalling: true,
                },
                agents: {
                    deepResearch: false,
                },
            },
        },
    },

    //* Gemini 3 Flash Preview
    {
        id: "gemini-3-flash-preview",
        category: "reasoning",
        provider: "Gemini",
        providerModelId: "gemini-3-flash-preview",
        name: "Gemini 3 Flash",
        description: "Fast, frontier-class performance with upgraded visual and spatial reasoning",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gemini.svg",
            dark: "/icons/gemini.svg",
        },
        providerMetadata: {
            provider: "Gemini",
            metadata: {
                contextWindow: 1048576,
                maxOutputTokens: 64000,
                knowledgeCutoff: "January 2025",
                latestUpdate: "December 2025",
                inputModalities: ["text", "image", "video", "audio", "pdf"],
                outputModalities: ["text"],
                capabilities: {
                    audioGeneration: false,
                    imageGeneration: false,
                    videoGeneration: false,
                    batchAPI: true,
                    caching: true,
                    liveAPI: false,
                    thinking: true,
                    structuredOutputs: true,
                },
                tools: {
                    googleSearch: true,
                    googleMaps: false,
                    codeExecution: true,
                    urlContext: true,
                    computerUse: false,
                    fileSearch: true,
                    functionCalling: true,
                },
                agents: {
                    deepResearch: false,
                },
            },
        },
    },

    //* Gemini 2.5 Flash
    {
        id: "gemini-2.5-flash",
        category: "reasoning",
        provider: "Gemini",
        providerModelId: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Stable, fast model with Google Maps grounding support",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gemini.svg",
            dark: "/icons/gemini.svg",
        },
        providerMetadata: {
            provider: "Gemini",
            metadata: {
                contextWindow: 1048576,
                maxOutputTokens: 65536,
                knowledgeCutoff: "January 2025",
                latestUpdate: "June 2025",
                inputModalities: ["text", "image", "video", "audio"],
                outputModalities: ["text"],
                capabilities: {
                    audioGeneration: false,
                    imageGeneration: false,
                    videoGeneration: false,
                    batchAPI: true,
                    caching: true,
                    liveAPI: false,
                    thinking: true,
                    structuredOutputs: true,
                },
                tools: {
                    googleSearch: true,
                    googleMaps: true,
                    codeExecution: true,
                    urlContext: true,
                    computerUse: false,
                    fileSearch: true,
                    functionCalling: true,
                },
                agents: {
                    deepResearch: false,
                },
            },
        },
    },

    //* Gemini 2.5 Flash Preview
    {
        id: "gemini-2.5-flash-preview-09-2025",
        category: "reasoning",
        provider: "Gemini",
        providerModelId: "gemini-2.5-flash-preview-09-2025",
        name: "Gemini 2.5 Flash Preview",
        description: "Preview version of Gemini 2.5 Flash with latest updates",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gemini.svg",
            dark: "/icons/gemini.svg",
        },
        providerMetadata: {
            provider: "Gemini",
            metadata: {
                contextWindow: 1048576,
                maxOutputTokens: 65536,
                knowledgeCutoff: "January 2025",
                latestUpdate: "September 2025",
                inputModalities: ["text", "image", "video", "audio"],
                outputModalities: ["text"],
                capabilities: {
                    audioGeneration: false,
                    imageGeneration: false,
                    videoGeneration: false,
                    batchAPI: true,
                    caching: true,
                    liveAPI: false,
                    thinking: true,
                    structuredOutputs: true,
                },
                tools: {
                    googleSearch: true,
                    googleMaps: false,
                    codeExecution: true,
                    urlContext: true,
                    computerUse: false,
                    fileSearch: true,
                    functionCalling: true,
                },
                agents: {
                    deepResearch: false,
                },
            },
        },
    },

    //* Gemini 2.5 Flash Lite
    {
        id: "gemini-2.5-flash-lite",
        category: "reasoning",
        provider: "Gemini",
        providerModelId: "gemini-2.5-flash-lite",
        name: "Gemini 2.5 Flash Lite",
        description: "Stable, cost-efficient model with Google Maps grounding support",
        premium: false,
        enabled: true,
        icon: {
            light: "/icons/gemini.svg",
            dark: "/icons/gemini.svg",
        },
        providerMetadata: {
            provider: "Gemini",
            metadata: {
                contextWindow: 1048576,
                maxOutputTokens: 65536,
                knowledgeCutoff: "January 2025",
                latestUpdate: "July 2025",
                inputModalities: ["text", "image", "video", "audio", "pdf"],
                outputModalities: ["text"],
                capabilities: {
                    audioGeneration: false,
                    imageGeneration: false,
                    videoGeneration: false,
                    batchAPI: true,
                    caching: true,
                    liveAPI: false,
                    thinking: true,
                    structuredOutputs: true,
                },
                tools: {
                    googleSearch: true,
                    googleMaps: true,
                    codeExecution: true,
                    urlContext: true,
                    computerUse: false,
                    fileSearch: true,
                    functionCalling: true,
                },
                agents: {
                    deepResearch: false,
                },
            },
        },
    },

    // ========================================================================
    // XAI GROK - Reasoning Models
    // ========================================================================

    //* Grok 4 - Latest flagship
    {
        id: "grok-4",
        category: "reasoning",
        provider: "Grok",
        providerModelId: "grok-4",
        name: "Grok 4",
        description: "Latest flagship model from xAI with maximum capabilities",
        premium: true,
        enabled: true,
        icon: {
            light: "/icons/grok-claro.svg",
            dark: "/icons/grok-oscuro.svg",
        },
        providerMetadata: {
            provider: "Grok",
            metadata: {
                contextWindow: 256000,
                maxOutputTokens: 16384,
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
                    inputPerMillion: 3.00,
                    cachedInputPerMillion: 0.75,
                    outputPerMillion: 15.00,
                }
            },
        },
    },

    //* Grok 3 - Previous flagship
    {
        id: "grok-3",
        category: "reasoning",
        provider: "Grok",
        providerModelId: "grok-3",
        name: "Grok 3",
        description: "Previous generation flagship reasoning model",
        premium: true,
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
                    inputPerMillion: 3.00,
                    cachedInputPerMillion: 0.75,
                    outputPerMillion: 15.00,
                }
            },
        },
    },

    // ========================================================================
    // DEEPSEEK - Reasoning Models
    // ========================================================================

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
                maxOutputTokens: 64000,
                inputModalities: ["text"],
                outputModalities: ["text"],
                features: {
                    streaming: true,
                    functionCalling: true,
                    chatPrefixCompletion: true,
                    fimCompletion: false,
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

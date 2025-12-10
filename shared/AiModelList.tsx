import { AIModel } from "../types/AiModel";

const AI_MODELS: AIModel[] = [
    {
        model: "GPT",
        iconLight: "/icons/gpt-claro.svg",
        iconDark: "/icons/gpt-oscuro.svg",
        premium: false,
        enabled: true,
        subModel: [
            { 
                name: "GPT 5.1", 
                premium: false, 
                enabled: true, 
                id: "gpt-5.1-2025-11-13",
                capabilities: {
                    search: true,
                    deepthought: false,
                    image: true,
                    video: false,
                }
            },
            { 
                name: "GPT 5 mini", 
                premium: false, 
                enabled: true, 
                id: "gpt-5-mini-2025-08-07",
                capabilities: {
                    search: true,
                    deepthought: false,
                    image: false,
                    video: false,
                }
            },
            { 
                name: "GPT 5 nano", 
                premium: false, 
                enabled: true, 
                id: "gpt-5-nano-2025-08-07",
                capabilities: {
                    search: true,
                    deepthought: false,
                    image: true,
                    video: false,
                }
            },
            { 
                name: "GPT 5 pro", 
                premium: true, 
                enabled: true, 
                id: "gpt-5-pro-2025-10-06",
                capabilities: {
                    search: true,
                    deepthought: false,
                    image: true,
                    video: false,
                }
            },
            { 
                name: "GPT 5", 
                premium: true, 
                enabled: true, 
                id: "gpt-5-2025-08-07",
                capabilities: {
                    search: true,
                    deepthought: false,
                    image: true,
                    video: false,
                }
            },
            { 
                name: "GPT 4.1", 
                premium: false, 
                enabled: true, 
                id: "gpt-4.1-2025-04-14",
                capabilities: {
                    search: true,
                    deepthought: false,
                    image: true,
                    video: false,
                }
            },
        ],
    },
    {
        model: "Gemini",
        iconLight: "/icons/gemini.svg",
        iconDark: "/icons/gemini.svg",
        premium: false,
        enabled: true,
        subModel: [
            { 
                name: "Gemini 3 Pro Preview", 
                premium: false, 
                enabled: true, 
                id: "gemini-3-pro-preview",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: false,
                    video: false,
                }
            },
            { 
                name: "Gemini 3 Pro Image Preview", 
                premium: false, 
                enabled: true, 
                id: "gemini-3-pro-image-preview",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: true,
                    video: false,
                }
            },
            { 
                name: "Gemini 2.5 Flash", 
                premium: true, 
                enabled: true, 
                id: "gemini-2.5-flash",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: false,
                    video: false,
                }
            },
            {
                name: "Gemini 2.5 Flash Image",
                premium: true, 
                enabled: true, 
                id: "gemini-2.5-flash-image",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: true,
                    video: false,
                }
            },
            {
                name: "Gemini 2.5 Flash-Lite",
                premium: true, 
                enabled: true, 
                id: "gemini-2.5-flash-lite",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: false,
                    video: false,
                }
            },
            {
                name: "Gemini 2.5 Pro",
                premium: true, 
                enabled: true, 
                id: "gemini-2.5-pro",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: false,
                    video: false,
                }
            }
        ],
    },
    {
        model: "Claude",
        iconLight: "/icons/claude.svg",
        iconDark: "/icons/claude.svg",
        premium: false,
        enabled: true,
        subModel: [
            { 
                name: "Claude Sonnet 4.5", 
                premium: false, 
                enabled: true, 
                id: "claude-sonnet-4-5-20250929",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: false,
                    video: false,
                }
            },
            { 
                name: "Claude Haiku 4.5", 
                premium: false, 
                enabled: true, 
                id: "claude-haiku-4-5-20251001",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: false,
                    video: false,
                }
            },
            { 
                name: "Claude Opus 4.5", 
                premium: true, 
                enabled: true, 
                id: "claude-opus-4-5-20251101",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: false,
                    video: false,
                }
            },
            {
                name: "Claude Opus 4.1 (Legacy)",
                premium: true,
                enabled: true,
                id: "claude-opus-4-1-20250805",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: false,
                    video: false,
                }
            }
        ],
    },
    {
        model: "Grok",
        iconLight: "/icons/grok-claro.svg",
        iconDark: "/icons/grok-oscuro.svg",
        premium: true,
        enabled: true,
        subModel: [
            { 
                name: "Grok 4.1 Fast Reasoning", 
                premium: false, 
                enabled: true, 
                id: "grok-4-1-fast-reasoning",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: true,
                    video: true,
                }
            },
            { 
                name: "Grok 4.1 Fast Non-Reasoning", 
                premium: true, 
                enabled: true, 
                id: "grok-4-1-fast-non-reasoning",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: true,
                    video: true,
                }
            },
            {
                name: "Grok 4 Fast Reasoning",
                premium: true,
                enabled: true,
                id: "grok-4-fast-reasoning",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: true,
                    video: true,
                }
            },
            {
                name: "Grok 4 Fast Non-Reasoning",
                premium: true,
                enabled: true,
                id: "grok-4-fast-non-reasoning",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: true,
                    video: true,
                }
            }
        ],
    },
    {
        model: "DeepSeek",
        iconLight: "/icons/deepseek.svg",
        iconDark: "/icons/deepseek.svg",
        premium: false,
        enabled: true,
        subModel: [
            { 
                name: "DeepSeek V3.2", 
                premium: false, 
                enabled: true, 
                id: "deepseek-reasoner",
                capabilities: {
                    search: true,
                    deepthought: true,
                    image: false,
                    video: false,
                }
            },
        ],
    }
];

export default AI_MODELS;
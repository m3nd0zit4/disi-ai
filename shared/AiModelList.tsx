import { AIModel } from "../types/AiModel";

const AI_MODELS: AIModel[] = [
    {
        model: "GPT",
        icon: "/icons/gpt.svg",
        premium: false,
        enabled: true,
        subModel: [
            { 
                name: "GPT 3.5", 
                premium: false, 
                enabled: true, 
                id: "gpt-3.5",
                capabilities: {
                    search: true,
                    code: true,
                    image: false,
                    video: false,
                    files: { github: false, figma: false, local: true }
                }
            },
            { 
                name: "GPT 3.5 turbo", 
                premium: false, 
                enabled: true, 
                id: "gpt-3.5-turbo",
                capabilities: {
                    search: true,
                    code: true,
                    image: false,
                    video: false,
                    files: { github: true, figma: false, local: true }
                }
            },
            { 
                name: "GPT 4.1 mini", 
                premium: false, 
                enabled: true, 
                id: "gpt-4.1-mini",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: false,
                    files: { github: true, figma: false, local: true }
                }
            },
            { 
                name: "GPT 4.1", 
                premium: true, 
                enabled: true, 
                id: "gpt-4.1",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: false,
                    files: { github: true, figma: false, local: true }
                }
            },
            { 
                name: "GPT 5 nano", 
                premium: false, 
                enabled: true, 
                id: "gpt-5-nano",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: false,
                    files: { github: true, figma: false, local: true }
                }
            },
            { 
                name: "GPT 5 mini", 
                premium: false, 
                enabled: true, 
                id: "gpt-5-mini",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: true,
                    files: { github: true, figma: false, local: true }
                }
            },
            { 
                name: "GPT 5", 
                premium: true, 
                enabled: true, 
                id: "gpt-5",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: true,
                    files: { github: true, figma: true, local: true }
                }
            }
        ],
    },
    {
        model: "Gemini",
        icon: "/icons/gemini.svg",
        premium: false,
        enabled: true,
        subModel: [
            { 
                name: "Gemini 2.5 Lite", 
                premium: false, 
                enabled: true, 
                id: "gemini-2.5-flash-lite",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: false,
                    files: { github: true, figma: false, local: true }
                }
            },
            { 
                name: "Gemini 2.5 Flash", 
                premium: false, 
                enabled: true, 
                id: "gemini-2.5-flash",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: true,
                    files: { github: true, figma: false, local: true }
                }
            },
            { 
                name: "Gemini 2.5 Pro", 
                premium: true, 
                enabled: true, 
                id: "gemini-2.5-pro",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: true,
                    files: { github: true, figma: true, local: true }
                }
            }
        ],
    },
    {
        model: "Claude",
        icon: "/icons/claude.svg",
        premium: false,
        enabled: true,
        subModel: [
            { 
                name: "Claude 3.5 Sonnet", 
                premium: false, 
                enabled: true, 
                id: "claude-3.5-sonnet",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: false,
                    files: { github: true, figma: true, local: true }
                }
            },
            { 
                name: "Claude 3.5 Haiku", 
                premium: false, 
                enabled: true, 
                id: "claude-3.5-haiku",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: false,
                    files: { github: true, figma: false, local: true }
                }
            },
            { 
                name: "Claude 3.5", 
                premium: true, 
                enabled: true, 
                id: "claude-3.5",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: false,
                    files: { github: true, figma: true, local: true }
                }
            }
        ],
    },
    {
        model: "Grok",
        icon: "/icons/grok.svg",
        premium: true,
        enabled: true,
        subModel: [
            { 
                name: "Grok 3 Mini", 
                premium: false, 
                enabled: true, 
                id: "grok-3-mini",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: true,
                    files: { github: false, figma: false, local: true }
                }
            },
            { 
                name: "Grok 3", 
                premium: true, 
                enabled: true, 
                id: "grok-3",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: true,
                    files: { github: true, figma: false, local: true }
                }
            }
        ],
    },
    {
        model: "DeepSeek",
        icon: "/icons/deepseek.svg",
        premium: false,
        enabled: true,
        subModel: [
            { 
                name: "DeepSeek R1", 
                premium: false, 
                enabled: true, 
                id: "deepseek-r1",
                capabilities: {
                    search: false,
                    code: true,
                    image: false,
                    video: false,
                    files: { github: true, figma: false, local: true }
                }
            },
            { 
                name: "DeepSeek R1 0528", 
                premium: true, 
                enabled: true, 
                id: "deepseek-r1-0528",
                capabilities: {
                    search: true,
                    code: true,
                    image: true,
                    video: false,
                    files: { github: true, figma: false, local: true }
                }
            }
        ],
    }
];

export default AI_MODELS;
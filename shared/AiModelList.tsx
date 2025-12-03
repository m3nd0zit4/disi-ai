const AI_MODELS = [
    {
        model: "GPT",
        icon: "/icons/gpt.svg",
        premium: false,
        enabled: true,
        subModel: [
            { name: "GPT 3.5", premium: false, enabled: true, id: "gpt-3.5" },
            { name: "GPT 3.5 turbo", premium: false, enabled: true, id: "gpt-3.5-turbo" },
            { name: "GPT 4.1 mini", premium: false, enabled: true, id: "gpt-4.1-mini" },
            { name: "GPT 4.1", premium: true, enabled: true, id: "gpt-4.1" },
            { name: "GPT 5 nano", premium: false, enabled: true, id: "gpt-5-nano" },
            { name: "GPT 5 mini", premium: false, enabled: true, id: "gpt-5-mini" },
            { name: "GPT 5", premium: true, enabled: true, id: "gpt-5" }
        ],
    },
    {
        model: "Gemini",
        icon: "/icons/gemini.svg",
        premium: false,
        enabled: true,
        subModel: [
            { name: "Gemini 2.5 Lite", premium: false, enabled: true, id: "gemini-2.5-flash-lite" },
            { name: "Gemini 2.5 Flash", premium: false, enabled: true, id: "gemini-2.5-flash" },
            { name: "Gemini 2.5 Pro", premium: true, enabled: true, id: "gemini-2.5-pro" }
        ],
    },
    {
        model: "Claude",
        icon: "/icons/claude.svg",
        premium: false,
        enabled: true,
        subModel: [
            { name: "Claude 3.5 Sonnet", premium: false, enabled: true, id: "claude-3.5-sonnet" },
            { name: "Claude 3.5 Haiku", premium: false, enabled: true, id: "claude-3.5-haiku" },
            { name: "Claude 3.5", premium: true, enabled: true, id: "claude-3.5" }
        ],
    },
    {
        model: "Qwen",
        icon: "/icons/qwen.svg",
        premium: false,
        enabled: true,
        subModel: [
            { name: "Qwen 2.5", premium: false, enabled: true, id: "qwen-2.5" },
            { name: "Qwen 2.5 Pro", premium: true, enabled: true, id: "qwen-2.5-pro" }
        ],
    },
    {
        model: "Grok",
        icon: "/icons/grok.svg",
        premium: true,
        enabled: true,
        subModel: [
            { name: "Grok 3 Mini", premium: false, enabled: true, id: "grok-3-mini" },
            { name: "Grok 3", premium: true, enabled: true, id: "grok-3" }
        ],
    },
    {
        model: "DeepSeek",
        icon: "/icons/deepseek.svg",
        premium: false,
        enabled: true,
        subModel: [
            { name: "DeepSeek R1", premium: false, enabled: true, id: "DeepSeek-R1" },
            { name: "DeepSeek R1 0528", premium: true, enabled: true, id: "DeepSeek-R1-0528" }
        ],
    }
];

export default AI_MODELS;

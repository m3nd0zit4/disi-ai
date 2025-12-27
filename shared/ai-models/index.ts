import { SpecializedModel } from "@/types/AiModel";
import { OPENAI_MODELS } from "./openai-models";
import { GEMINI_MODELS } from "./gemini-models";
import { CLAUDE_MODELS } from "./claude-models";
import { GROK_MODELS } from "./grok-models";
import { DEEPSEEK_MODELS } from "./deepseek-models";

export const SPECIALIZED_MODELS: SpecializedModel[] = [
    ...OPENAI_MODELS,
    ...GEMINI_MODELS,
    ...CLAUDE_MODELS,
    ...GROK_MODELS,
    ...DEEPSEEK_MODELS,
];

export default SPECIALIZED_MODELS;

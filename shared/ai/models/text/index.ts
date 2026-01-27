/**
 * Text Models - Index
 *
 * Exports all text-based AI models (reasoning and standard chat).
 *
 * @date 2026-01-25
 */

import { SpecializedModel } from "@/types/AiModel";
import { TEXT_REASONING_MODELS } from "./reasoning";
import { TEXT_STANDARD_MODELS } from "./standard";

// Re-export individual collections
export { TEXT_REASONING_MODELS } from "./reasoning";
export { TEXT_STANDARD_MODELS } from "./standard";

/**
 * All text models combined (reasoning + standard)
 */
export const TEXT_MODELS: SpecializedModel[] = [
    ...TEXT_REASONING_MODELS,
    ...TEXT_STANDARD_MODELS,
];

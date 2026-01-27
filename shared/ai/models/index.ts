/**
 * AI Models - Main Index
 *
 * Exports all AI models organized by capability.
 *
 * @architecture
 * ```
 * models/
 * ├── text/
 * │   ├── reasoning.ts    - Advanced reasoning models
 * │   ├── standard.ts     - Basic chat models
 * │   └── index.ts
 * ├── image/
 * │   ├── generation.ts   - Image creation models
 * │   └── index.ts
 * ├── video/
 * │   ├── generation.ts   - Video creation models
 * │   └── index.ts
 * └── index.ts            - This file
 * ```
 *
 * @date 2026-01-25
 */

import { SpecializedModel } from "@/types/AiModel";

// Text models
export { TEXT_REASONING_MODELS, TEXT_STANDARD_MODELS, TEXT_MODELS } from "./text";

// Image models
export { IMAGE_GENERATION_MODELS } from "./image";

// Video models
export { VIDEO_GENERATION_MODELS } from "./video";

// Import for combining
import { TEXT_REASONING_MODELS, TEXT_STANDARD_MODELS } from "./text";
import { IMAGE_GENERATION_MODELS } from "./image";
import { VIDEO_GENERATION_MODELS } from "./video";

/**
 * All visual generation models (image + video)
 */
export const VISUAL_MODELS: SpecializedModel[] = [
    ...IMAGE_GENERATION_MODELS,
    ...VIDEO_GENERATION_MODELS,
];

/**
 * All specialized models combined
 * This is the main export for backward compatibility
 */
export const SPECIALIZED_MODELS: SpecializedModel[] = [
    ...TEXT_REASONING_MODELS,
    ...TEXT_STANDARD_MODELS,
    ...IMAGE_GENERATION_MODELS,
    ...VIDEO_GENERATION_MODELS,
];

export default SPECIALIZED_MODELS;

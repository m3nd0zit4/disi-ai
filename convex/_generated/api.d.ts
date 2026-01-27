/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as canvas_canvas from "../canvas/canvas.js";
import type * as canvas_canvasExecutions from "../canvas/canvasExecutions.js";
import type * as knowledge_garden_actions from "../knowledge_garden/actions.js";
import type * as knowledge_garden_knowledgeBases from "../knowledge_garden/knowledgeBases.js";
import type * as knowledge_garden_seedCandidates from "../knowledge_garden/seedCandidates.js";
import type * as knowledge_garden_seedLinks from "../knowledge_garden/seedLinks.js";
import type * as knowledge_garden_seeds from "../knowledge_garden/seeds.js";
import type * as system_ai from "../system/ai.js";
import type * as system_files from "../system/files.js";
import type * as system_storage from "../system/storage.js";
import type * as system_worker from "../system/worker.js";
import type * as users_settings from "../users/settings.js";
import type * as users_users from "../users/users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "canvas/canvas": typeof canvas_canvas;
  "canvas/canvasExecutions": typeof canvas_canvasExecutions;
  "knowledge_garden/actions": typeof knowledge_garden_actions;
  "knowledge_garden/knowledgeBases": typeof knowledge_garden_knowledgeBases;
  "knowledge_garden/seedCandidates": typeof knowledge_garden_seedCandidates;
  "knowledge_garden/seedLinks": typeof knowledge_garden_seedLinks;
  "knowledge_garden/seeds": typeof knowledge_garden_seeds;
  "system/ai": typeof system_ai;
  "system/files": typeof system_files;
  "system/storage": typeof system_storage;
  "system/worker": typeof system_worker;
  "users/settings": typeof users_settings;
  "users/users": typeof users_users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

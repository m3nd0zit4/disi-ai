/**
 * Knowledge Garden reference types for @-style referencing.
 * Used when sending kbRefs from ChatInputBox to Execute API.
 */

export type KbRef =
  | { type: "kb"; kbId: string }
  | { type: "seed"; kbId: string; seedIds: string[] }
  | { type: "tag"; kbId: string; tags: string[] }
  | { type: "file"; kbId: string; fileIds: string[] };

export type KbRefType = KbRef["type"];

/** Unified item shape for RAG context (id, title, content, kbId, optional score) */
export interface KbContextItem {
  id: string;
  title?: string;
  content?: string;
  kbId?: string;
  score?: number;
}

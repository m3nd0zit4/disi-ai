/**
 * Base interface for tool information across all providers.
 * T is the union of string literals for the tool IDs.
 */
export interface BaseToolInfo<T extends string = string> {
  id: T;
  name: string;
  description: string;
  useCases: string[];
  docsUrl: string;
  isPreview?: boolean;
  isAgent?: boolean; // Optional for all, but specifically used by Gemini
}

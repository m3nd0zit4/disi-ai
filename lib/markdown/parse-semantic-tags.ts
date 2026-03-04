/**
 * Semantic Tags Parser for AI Responses
 *
 * Parses HTML-like semantic tags from AI model responses:
 * - <reasoning>...</reasoning> - AI thinking/analysis content
 * - <sources>...</sources> - YAML list of references
 * - <tool name="..." status="...">...</tool> - Tool execution display
 */

import * as yaml from 'js-yaml';
import type { ToolPart } from '@/components/ui/tool';

export interface SemanticBlock {
  type: 'reasoning' | 'sources' | 'tool' | 'text';
  content: string;
  metadata?: {
    name?: string;
    status?: 'pending' | 'running' | 'completed' | 'error';
    sources?: Array<{ title?: string; url: string; description?: string }>;
    toolPart?: ToolPart;
  };
}

/**
 * Map semantic tag status to ToolPart state
 */
function mapStatusToToolState(status: string): ToolPart['state'] {
  switch (status) {
    case 'pending':
      return 'input-available';
    case 'running':
      return 'input-streaming';
    case 'completed':
      return 'output-available';
    case 'error':
      return 'output-error';
    default:
      return 'input-available';
  }
}

/**
 * Parse tool content to extract input/output if structured
 */
function parseToolContent(content: string): { input?: Record<string, unknown>; output?: Record<string, unknown> } {
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null) {
      return { output: parsed };
    }
  } catch {
    // Not JSON, try YAML
  }

  // Try to parse as YAML
  try {
    const parsed = yaml.load(content);
    if (typeof parsed === 'object' && parsed !== null) {
      return { output: parsed as Record<string, unknown> };
    }
  } catch {
    // Not YAML either
  }

  // Return as plain text output
  if (content.trim()) {
    return { output: { result: content.trim() } };
  }

  return {};
}

/**
 * Parse markdown content and extract semantic tag blocks
 */
export function parseSemanticTags(markdown: string): SemanticBlock[] {
  if (!markdown || typeof markdown !== 'string') {
    return [{ type: 'text', content: '' }];
  }

  const blocks: SemanticBlock[] = [];

  // Combined pattern to match all semantic tags
  const combinedPattern = new RegExp(
    `(<reasoning>[\\s\\S]*?<\\/reasoning>)|(<sources>[\\s\\S]*?<\\/sources>)|(<tool\\s+[^>]+>[\\s\\S]*?<\\/tool>)`,
    'g'
  );

  let lastIndex = 0;
  let match;

  while ((match = combinedPattern.exec(markdown)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      const textContent = markdown.slice(lastIndex, match.index).trim();
      if (textContent) {
        blocks.push({
          type: 'text',
          content: textContent
        });
      }
    }

    const fullMatch = match[0];

    // Parse reasoning tag
    if (fullMatch.startsWith('<reasoning>')) {
      const content = fullMatch
        .replace(/<reasoning>/g, '')
        .replace(/<\/reasoning>/g, '')
        .trim();

      blocks.push({
        type: 'reasoning',
        content
      });
    }
    // Parse sources tag (YAML content)
    else if (fullMatch.startsWith('<sources>')) {
      const yamlContent = fullMatch
        .replace(/<sources>/g, '')
        .replace(/<\/sources>/g, '')
        .trim();

      try {
        const sources = yaml.load(yamlContent) as Array<{
          title?: string;
          url: string;
          description?: string;
        }>;

        if (Array.isArray(sources)) {
          blocks.push({
            type: 'sources',
            content: '',
            metadata: { sources }
          });
        } else {
          // Invalid YAML structure, render as text
          blocks.push({ type: 'text', content: fullMatch });
        }
      } catch (e) {
        // YAML parsing failed, render as text
        console.warn('[parseSemanticTags] Failed to parse sources YAML:', e);
        blocks.push({ type: 'text', content: fullMatch });
      }
    }
    // Parse tool tag
    else if (fullMatch.startsWith('<tool')) {
      // Try name="..." status="..." pattern
      let toolMatch = fullMatch.match(
        /<tool\s+name="([^"]+)"\s+status="([^"]+)">([\s\S]*?)<\/tool>/
      );

      // Try status="..." name="..." pattern
      if (!toolMatch) {
        const altMatch = fullMatch.match(
          /<tool\s+status="([^"]+)"\s+name="([^"]+)">([\s\S]*?)<\/tool>/
        );
        if (altMatch) {
          toolMatch = [altMatch[0], altMatch[2], altMatch[1], altMatch[3]];
        }
      }

      // Try type="..." state="..." pattern (PromptKit format)
      if (!toolMatch) {
        const pkMatch = fullMatch.match(
          /<tool\s+type="([^"]+)"\s+state="([^"]+)">([\s\S]*?)<\/tool>/
        );
        if (pkMatch) {
          const [, type, state, content] = pkMatch;
          const { input, output } = parseToolContent(content.trim());

          blocks.push({
            type: 'tool',
            content: content.trim(),
            metadata: {
              name: type,
              toolPart: {
                type,
                state: state as ToolPart['state'],
                input,
                output
              }
            }
          });
          lastIndex = match.index + fullMatch.length;
          continue;
        }
      }

      if (toolMatch) {
        const [, name, status, content] = toolMatch;
        const { input, output } = parseToolContent(content.trim());

        blocks.push({
          type: 'tool',
          content: content.trim(),
          metadata: {
            name,
            status: status as 'pending' | 'running' | 'completed' | 'error',
            toolPart: {
              type: name,
              state: mapStatusToToolState(status),
              input,
              output,
              errorText: status === 'error' ? content.trim() : undefined
            }
          }
        });
      } else {
        // Could not parse, render as text
        blocks.push({ type: 'text', content: fullMatch });
      }
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text after last match
  if (lastIndex < markdown.length) {
    const remainingText = markdown.slice(lastIndex).trim();
    if (remainingText) {
      blocks.push({
        type: 'text',
        content: remainingText
      });
    }
  }

  // If no blocks were created, return the original content as text
  if (blocks.length === 0) {
    return [{ type: 'text', content: markdown }];
  }

  return blocks;
}

/**
 * Check if content contains any semantic tags
 */
export function hasSemanticTags(markdown: string): boolean {
  if (!markdown || typeof markdown !== 'string') return false;

  return (
    markdown.includes('<reasoning>') ||
    markdown.includes('<sources>') ||
    markdown.includes('<tool ')
  );
}

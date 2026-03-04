/**
 * Remark Plugin for PromptKit Directives
 *
 * Transforms markdown directives into custom component nodes:
 * - :::source[Label]{href="..." showFavicon=true}
 * - :::reasoning[Button Text]
 */

import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Content, Text, Paragraph, List, Code, InlineCode, Strong, Emphasis } from 'mdast';
import type { Node } from 'unist';

interface DirectiveNode {
  type: 'containerDirective' | 'leafDirective' | 'textDirective';
  name: string;
  attributes?: Record<string, string | boolean>;
  children?: Content[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
  value?: string;
  position?: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
}

/**
 * Parse source directive content to extract title and description
 * Format:
 * Title: Page Title
 * Description: Page description
 */
function parseSourceContent(children: Content[]): { title?: string; description?: string } {
  const result: { title?: string; description?: string } = {};

  // Convert children to text
  let text = '';
  for (const child of children) {
    if (child.type === 'text') {
      text += child.value;
    } else if (child.type === 'paragraph' && 'children' in child) {
      for (const paragraphChild of child.children) {
        if (paragraphChild.type === 'text') {
          text += paragraphChild.value;
        }
      }
      text += '\n';
    }
  }

  // Parse lines
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Title:')) {
      result.title = trimmed.substring(6).trim();
    } else if (trimmed.startsWith('Description:')) {
      result.description = trimmed.substring(12).trim();
    }
  }

  return result;
}

/**
 * Convert directive children to plain text (for reasoning content)
 */
function childrenToText(children: Content[]): string {
  let text = '';

  function processNode(node: Content) {
    if (node.type === 'text') {
      text += node.value;
    } else if (node.type === 'strong' || node.type === 'emphasis') {
      // Preserve markdown formatting
      if ('children' in node && node.children) {
        const marker = node.type === 'strong' ? '**' : '*';
        text += marker;
        node.children.forEach(processNode);
        text += marker;
      }
    } else if (node.type === 'paragraph') {
      if ('children' in node && node.children) {
        node.children.forEach(processNode);
        text += '\n\n';
      }
    } else if (node.type === 'list') {
      if ('children' in node && node.children) {
        node.children.forEach((item, index) => {
          const ordered = node.ordered || false;
          const marker = ordered ? `${index + 1}. ` : '- ';
          text += marker;
          if ('children' in item && item.children) {
            item.children.forEach(processNode);
          }
          text += '\n';
        });
        text += '\n';
      }
    } else if (node.type === 'code') {
      text += `\`\`\`${node.lang || ''}\n${node.value}\n\`\`\`\n`;
    } else if (node.type === 'inlineCode') {
      text += `\`${node.value}\``;
    } else if ('children' in node && node.children) {
      (node.children as Content[]).forEach(processNode);
    }
  }

  children.forEach(processNode);
  return text.trim();
}

/**
 * PromptKit Directives Plugin
 */
export const remarkPromptKitDirectives: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, (node: Node) => {
      if (node.type !== 'containerDirective') return;

      const directive = node as DirectiveNode;

      // Handle :::source directive
      if (directive.name === 'source') {
        const href = directive.attributes?.href as string;

        if (!href) {
          console.warn('[PromptKit] Source directive missing href attribute, skipping');
          return;
        }

        // Extract label from directive syntax: :::source[Label]
        // This is in the first child if it's text
        let label = '';
        if (directive.children && directive.children.length > 0) {
          const firstChild = directive.children[0];
          if (firstChild.type === 'text') {
            label = firstChild.value;
          }
        }

        // Parse content for title and description
        const { title, description } = parseSourceContent(directive.children || []);

        // Transform to custom node for react-markdown
        directive.data = directive.data || {};
        directive.data.hName = 'sourceDirective';
        directive.data.hProperties = {
          href,
          label,
          showFavicon: directive.attributes?.showFavicon === true || directive.attributes?.showFavicon === 'true',
          title,
          description,
        };
      }

      // Handle :::reasoning directive
      else if (directive.name === 'reasoning') {
        // Extract label from directive syntax: :::reasoning[Label]
        let label = '';
        if (directive.children && directive.children.length > 0) {
          const firstChild = directive.children[0];
          if (firstChild.type === 'text') {
            // Check if first text is the label
            const text = firstChild.value.trim();
            if (text.length < 50) { // Heuristic: labels are short
              label = text;
            }
          }
        }

        // Convert all children to markdown text
        const content = childrenToText(directive.children || []);

        // Transform to custom node for react-markdown
        directive.data = directive.data || {};
        directive.data.hName = 'reasoningDirective';
        directive.data.hProperties = {
          label: label || 'Show reasoning',
          content,
        };
      }
    });
  };
};

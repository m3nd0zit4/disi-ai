/**
 * PromptKit Component Mappings for React-Markdown
 *
 * Maps custom directive nodes to actual React components
 */

import React from 'react';
import { Source, SourceTrigger, SourceContent } from '@/components/ui/source';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ui/reasoning';

interface SourceDirectiveProps {
  href: string;
  label?: string;
  showFavicon?: boolean;
  title?: string;
  description?: string;
}

interface ReasoningDirectiveProps {
  label?: string;
  content: string;
}

/**
 * Source Directive Component
 * Renders a clickable badge with hover card showing source metadata
 */
function SourceDirective({
  href,
  label,
  showFavicon = false,
  title,
  description,
}: SourceDirectiveProps) {
  // If no title or description, don't render SourceContent
  const hasMetadata = title || description;

  return (
    <Source href={href}>
      <SourceTrigger label={label} showFavicon={showFavicon} />
      {hasMetadata && (
        <SourceContent
          title={title || ''}
          description={description || ''}
        />
      )}
    </Source>
  );
}

/**
 * Reasoning Directive Component
 * Renders a collapsible reasoning block with markdown support
 */
function ReasoningDirective({ label, content }: ReasoningDirectiveProps) {
  return (
    <div className="my-4">
      <Reasoning>
        <ReasoningTrigger className="mb-2">
          {label || 'Show reasoning'}
        </ReasoningTrigger>
        <ReasoningContent markdown>
          {content}
        </ReasoningContent>
      </Reasoning>
    </div>
  );
}

/**
 * Export component mappings for react-markdown
 */
export const promptKitComponents = {
  sourceDirective: SourceDirective,
  reasoningDirective: ReasoningDirective,
};

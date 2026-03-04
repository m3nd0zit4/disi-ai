import React from 'react';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ui/reasoning';

interface ThinkingDisplayProps {
  thinkingContent: string;
  isStreaming?: boolean;
}

export function ThinkingDisplay({ thinkingContent, isStreaming }: ThinkingDisplayProps) {
  if (!thinkingContent) return null;

  return (
    <Reasoning isStreaming={isStreaming}>
      <ReasoningTrigger>Show reasoning</ReasoningTrigger>
      <ReasoningContent className="ml-2 border-l-2 border-l-slate-200 px-2 pb-1 dark:border-l-slate-700">
        {thinkingContent}
      </ReasoningContent>
    </Reasoning>
  );
}

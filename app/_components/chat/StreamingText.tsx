"use client";

import { MessageContent } from "@/components/ui/message";

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  return (
    <div className="relative">
      <MessageContent markdown className="prose-sm text-primary w-full max-w-none bg-transparent p-0">
        {content || " "}
      </MessageContent>
      {isStreaming && (
        <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-1 align-middle">▊</span>
      )}
    </div>
  );
}
"use client";

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  return (
    <div className="relative">
      <div className="prose prose-sm max-w-none dark:prose-invert">
        {content}
      </div>
      {isStreaming && (
        <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-1">▊</span>
      )}
    </div>
  );
}
"use client";

import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Markdown } from "@/components/ui/markdown";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function AIThinkingBlock({ reasoning, modelName = "HextaAI" }: { reasoning?: string; modelName?: string }) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [reasoningCollapsed, setReasoningCollapsed] = useState(false);

  const ThinkingContent = reasoning || "";

  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timerInterval);
    };
  }, []);

  useEffect(() => {
    if (contentRef.current && ThinkingContent) {
      const scrollHeight = contentRef.current.scrollHeight;
      const clientHeight = contentRef.current.clientHeight;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 0) return;

      scrollIntervalRef.current = setInterval(() => {
        setScrollPosition((prev) => {
          const newPosition = prev + 1;
          if (newPosition >= maxScroll) {
            return 0;
          }
          return newPosition;
        });
      }, 50);

      return () => {
        if (scrollIntervalRef.current) {
          clearInterval(scrollIntervalRef.current);
        }
      };
    }
  }, [ThinkingContent]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  return (
    <div className="flex flex-col p-3 max-w-xl">
      <div className="flex items-center justify-start gap-2 mb-4">
        <Loader size={"sm"} />
        <p
          className="bg-[linear-gradient(110deg,#404040,35%,#fff,50%,#404040,75%,#404040)] bg-[length:200%_100%] bg-clip-text text-base text-transparent animate-[shimmer_5s_linear_infinite]"
          style={{
            animation: "shimmer 5s linear infinite",
          }}
        >
          {modelName} is thinking
        </p>
        <span className="text-sm text-muted-foreground">
          {timer}s
        </span>
        <style jsx>{`
          @keyframes shimmer {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: -200% 0;
            }
          }
        `}</style>
      </div>
      {ThinkingContent && (
        <Card className="relative overflow-hidden bg-secondary p-2 rounded-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Reasoning</span>
            <button
              type="button"
              onClick={() => setReasoningCollapsed(!reasoningCollapsed)}
              className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={reasoningCollapsed ? "Expand reasoning" : "Collapse reasoning"}
            >
              {reasoningCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
          {!reasoningCollapsed && (
            <>
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-30% from-secondary to-transparent z-10 pointer-events-none h-[80px]" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-30% from-secondary to-transparent z-10 pointer-events-none h-[80px]" />
              <div
                ref={contentRef}
                className="relative h-[150px] overflow-hidden p-4 text-secondary-foreground prose prose-sm dark:prose-invert max-w-none"
                style={{
                  scrollBehavior: "auto",
                }}
              >
                <Markdown>{ThinkingContent}</Markdown>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

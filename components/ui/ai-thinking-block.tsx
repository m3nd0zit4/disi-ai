"use client";

import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { useEffect, useRef, useState } from "react";

export default function AIThinkingBlock({ reasoning, modelName = "HextaAI" }: { reasoning?: string; modelName?: string }) {
const [scrollPosition, setScrollPosition] = useState(0);
const contentRef = useRef<HTMLDivElement>(null);
const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      <Card className="relative h-[150px] overflow-hidden bg-secondary p-2 rounded-card">
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-30% from-secondary to-transparent z-10 pointer-events-none h-[80px]" />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-30% from-secondary to-transparent z-10 pointer-events-none h-[80px]" />
        <div
          ref={contentRef}
          className="h-full overflow-hidden p-4 text-secondary-foreground"
          style={{
            scrollBehavior: "auto",
          }}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {ThinkingContent}
          </p>
        </div>
      </Card>
    )}
  </div>
);
}

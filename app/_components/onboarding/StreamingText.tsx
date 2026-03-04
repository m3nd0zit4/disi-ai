"use client";

import { useState, useEffect, useRef } from "react";

interface StreamingTextProps {
  text: string;
  /** Delay in ms before starting */
  delay?: number;
  /** Ms per character (lower = faster) */
  speed?: number;
  /** Show blinking cursor while streaming (default off for smoother look) */
  cursor?: boolean;
  /** Callback when streaming finishes */
  onComplete?: () => void;
  className?: string;
}

export function StreamingText({
  text,
  delay = 0,
  speed = 35,
  cursor = false,
  onComplete,
  className = "",
}: StreamingTextProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!text) {
      setDone(true);
      onCompleteRef.current?.();
      return;
    }
    setDisplayed("");
    setDone(false);

    const startAt = Date.now() + delay;
    let i = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;

    const run = () => {
      const now = Date.now();
      if (now < startAt) {
        rafId = requestAnimationFrame(run);
        return;
      }
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
        timeoutId = setTimeout(run, speed);
      } else {
        setDone(true);
        onCompleteRef.current?.();
      }
    };

    rafId = requestAnimationFrame(run);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [text, delay, speed]);

  return (
    <span className={className}>
      {displayed}
      {cursor && !done && (
        <span
          className="inline-block w-0.5 h-[1em] bg-primary align-baseline ml-0.5 animate-pulse"
          style={{ animationDuration: "1s" }}
          aria-hidden
        />
      )}
    </span>
  );
}

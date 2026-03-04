"use client";

import { useEffect, useState } from "react";

export interface TypewriterTextProps {
  /** Full text to reveal */
  text: string;
  /** Whether to animate (e.g. while loading); when false, show full text immediately */
  enabled?: boolean;
  /** Milliseconds per character (default 35) */
  charMs?: number;
  /** Optional suffix shown after the animated part (e.g. cursor) */
  suffix?: React.ReactNode;
  className?: string;
}

/**
 * Reveals text character-by-character (typewriter effect).
 * When enabled=false, shows full text. When text changes and enabled=true, resets and re-runs.
 */
export function TypewriterText({
  text,
  enabled = true,
  charMs = 35,
  suffix,
  className,
}: TypewriterTextProps) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setVisibleLength(text.length);
      return;
    }
    setVisibleLength(0);
    if (text.length === 0) return;
    let cancelled = false;
    let next = 0;
    const step = () => {
      if (cancelled) return;
      next += 1;
      setVisibleLength(Math.min(next, text.length));
      if (next < text.length) {
        const t = setTimeout(step, charMs);
        return () => clearTimeout(t);
      }
    };
    const t = setTimeout(step, charMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, enabled, charMs]);

  const visible = enabled ? text.slice(0, visibleLength) : text;

  return (
    <span className={className}>
      {visible}
      {suffix}
    </span>
  );
}

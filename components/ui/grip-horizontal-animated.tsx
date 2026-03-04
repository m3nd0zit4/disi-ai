"use client";

import { GripHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GripHorizontalAnimatedProps {
  className?: string;
  size?: number;
}

/**
 * Animated grip-horizontal icon (e.g. for "generating" state).
 * Uses framer-motion for a subtle opacity/slide animation.
 */
export function GripHorizontalAnimated({ className, size = 20 }: GripHorizontalAnimatedProps) {
  return (
    <motion.span
      className={cn("inline-flex shrink-0", className)}
      aria-hidden
      initial={{ opacity: 0.6 }}
      animate={{
        opacity: [0.6, 1, 0.6],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <GripHorizontal size={size} strokeWidth={2} className="text-primary" />
    </motion.span>
  );
}

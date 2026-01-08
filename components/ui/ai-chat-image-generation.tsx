"use client"

import * as React from "react"
import { motion } from "motion/react";

export interface ImageGenerationProps {
  children: React.ReactNode;
  loadingState?: "starting" | "generating" | "completed";
}

export const ImageGeneration = (
  ({ children, loadingState: externalLoadingState } : ImageGenerationProps) => {
    const [progress, setProgress] = React.useState(0);
    const [internalLoadingState, setInternalLoadingState] = React.useState<
      "starting" | "generating" | "completed"
    >("starting");
    
    const loadingState = externalLoadingState || internalLoadingState;
    const duration = 30000;

    React.useEffect(() => {
      if (externalLoadingState) return; // Skip internal timer if external state is provided

      let startingTimeout: NodeJS.Timeout | null = null;
      let interval: NodeJS.Timeout | null = null;

      startingTimeout = setTimeout(() => {
        setInternalLoadingState("generating");

        const startTime = Date.now();

        interval = setInterval(() => {
          const elapsedTime = Date.now() - startTime;
          const progressPercentage = Math.min(
            100,
            (elapsedTime / duration) * 100
          );

          setProgress(progressPercentage);

          if (progressPercentage >= 100) {
            if (interval) clearInterval(interval);
            setInternalLoadingState("completed");
          }
        }, 16);
      }, 3000);

      // Cleanup function that clears both timeout and interval
      return () => {
        if (startingTimeout) clearTimeout(startingTimeout);
        if (interval) clearInterval(interval);
      };
    }, [duration, externalLoadingState]);

    return (
      <div className="flex flex-col gap-2">
        <motion.span
          className="bg-[linear-gradient(110deg,var(--color-muted-foreground),35%,var(--color-foreground),50%,var(--color-muted-foreground),75%,var(--color-muted-foreground))] bg-[length:200%_100%] bg-clip-text text-transparent text-base font-medium"
          initial={{ backgroundPosition: "200% 0" }}
          animate={{
            backgroundPosition:
              loadingState === "completed" ? "0% 0" : "-200% 0",
          }}
          transition={{
            repeat: loadingState === "completed" ? 0 : Infinity,
            duration: 3,
            ease: "linear",
          }}
        >
          {loadingState === "starting" && "Getting started."}
          {loadingState === "generating" && "Creating image. May take a moment."}
          {loadingState === "completed" && "Image created."}
        </motion.span>
        <div className="relative rounded-xl border bg-card max-w-md overflow-hidden">
            {children}
          <motion.div
            className="absolute w-full h-[125%] -top-[25%] pointer-events-none backdrop-blur-3xl"
            initial={false}
            animate={{
              clipPath: `polygon(0 ${progress}%, 100% ${progress}%, 100% 100%, 0 100%)`,
              opacity: loadingState === "completed" ? 0 : 1,
            }}
            style={{
              clipPath: `polygon(0 ${progress}%, 100% ${progress}%, 100% 100%, 0 100%)`,
              maskImage:
                progress === 0
                  ? "linear-gradient(to bottom, black -5%, black 100%)"
                  : `linear-gradient(to bottom, transparent ${progress - 5}%, transparent ${progress}%, black ${progress + 5}%)`,
              WebkitMaskImage:
                progress === 0
                  ? "linear-gradient(to bottom, black -5%, black 100%)"
                  : `linear-gradient(to bottom, transparent ${progress - 5}%, transparent ${progress}%, black ${progress + 5}%)`,
            }}
          />
        </div>
      </div>
    );
  }
);

ImageGeneration.displayName = "ImageGeneration";

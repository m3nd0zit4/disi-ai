import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingVisualCardProps {
  /**
   * The visual content to show in the background.
   * Can be an image, video, or a preview component.
   * If null/undefined, a neutral gray blur will be used.
   * STRICTLY NO ICONS.
   */
  backgroundVisual?: React.ReactNode;
  
  /**
   * The main status message to display.
   * Will be animated with a typewriter/streaming effect.
   */
  statusMessage: string;
  
  /**
   * Progress percentage (0-100).
   * If not provided, it might show an indeterminate state or just the message.
   */
  progress?: number;
  
  /**
   * The mode determines specific styling nuances if needed.
   */
  mode?: 'kb' | 'image' | 'video';
  
  className?: string;
}

export function LoadingVisualCard({
  backgroundVisual,
  statusMessage,
  progress,
  mode = 'image',
  className
}: LoadingVisualCardProps) {
  const [displayMessage, setDisplayMessage] = useState("");
  
  // Typewriter effect logic
  useEffect(() => {
    let currentIndex = 0;
    setDisplayMessage("");
    
    const intervalId = setInterval(() => {
      if (currentIndex < statusMessage.length) {
        setDisplayMessage(prev => prev + statusMessage[currentIndex]);
        currentIndex++;
      }
    }, 80); // Speed of typing

    return () => clearInterval(intervalId);
  }, [statusMessage]);

  return (
    <div className={cn(
      "relative w-full h-full overflow-hidden rounded-xl bg-neutral-900/20 border border-white/5",
      className
    )}>
      {/* Layer 1: Background Visual (Blurred) */}
      <div className="absolute inset-0 z-0">
        {backgroundVisual ? (
          <div className="w-full h-full opacity-60 blur-md scale-110 transition-all duration-700">
            {backgroundVisual}
          </div>
        ) : (
          // Fallback neutral gray blur
          <div className="w-full h-full bg-neutral-800/50 blur-xl opacity-50" />
        )}
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      {/* Layer 2: Content Overlay */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-6 text-center">
        
        {/* Animated Text */}
        <div className="min-h-[3rem] flex items-center justify-center">
          <p className="text-sm md:text-base font-medium text-white/90 tracking-wide font-mono">
            {displayMessage}
            <span className="animate-pulse text-primary">_</span>
          </p>
        </div>

        {/* Progress Indicator */}
        {progress !== undefined && (
          <div className="w-full max-w-[180px] mt-4 space-y-2">
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>
            <p className="text-[10px] font-bold text-white/50 text-right">
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* Layer 3: Bottom "Thinking" State */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 border border-white/5 backdrop-blur-md">
            <ThinkingDots />
          </div>
        </div>
      </div>
    </div>
  );
}

const ThinkingDots = () => (
  <div className="flex gap-0.5 items-center h-full">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="w-1 h-1 bg-white/60 rounded-full"
        animate={{
          y: ["0%", "-50%", "0%"],
          opacity: [0.4, 1, 0.4]
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          delay: i * 0.15,
          ease: "easeInOut"
        }}
      />
    ))}
  </div>
);

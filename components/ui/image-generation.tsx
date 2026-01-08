"use client";

import React from "react";
import { motion } from "framer-motion";
import { Loader2, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Image } from "@/components/ui/image";

interface ImageGenerationProps {
  src?: string;
  alt?: string;
  status: "loading" | "thinking" | "streaming" | "completed" | "error";
  className?: string;
  aspectRatio?: "square" | "portrait" | "landscape";
}

export function ImageGeneration({
  src,
  alt = "Generated Image",
  status,
  className,
  aspectRatio = "square",
}: ImageGenerationProps) {
  const isLoading = status === "loading" || status === "thinking" || status === "streaming";
  
  const aspectRatioClasses = {
    square: "aspect-square",
    portrait: "aspect-[3/4]",
    landscape: "aspect-[16/9]",
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-muted/20 border border-border/50",
        aspectRatioClasses[aspectRatio],
        className
      )}
    >
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-background/80 shadow-lg border border-primary/10">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-xs font-medium text-muted-foreground/80 uppercase tracking-widest"
          >
            Generating Visuals...
          </motion.p>
          
          {/* Progress Bar Simulation */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: "90%" }}
              transition={{ duration: 8, ease: "linear" }}
            />
          </div>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-destructive/5">
          <ImageIcon className="w-12 h-12 text-destructive/40 mb-2" />
          <p className="text-sm font-medium text-destructive/80">Generation Failed</p>
        </div>
      )}

      {/* Image Content */}
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-full h-full"
        >
          <Image
            src={src}
            alt={alt}
            className="object-cover w-full h-full transition-transform duration-700 hover:scale-105"
          />
          
          {/* Inner Shadow for depth */}
          <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.1)] pointer-events-none" />
        </motion.div>
      )}
    </div>
  );
}

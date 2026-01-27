"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileText, Sprout, Database, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface GardenStatsPanelProps {
  isActive: boolean;
  stats: {
    files: number;
    seeds: number;
    tokens: number;
  };
}

export function GardenStatsPanel({ isActive, stats }: GardenStatsPanelProps) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: "auto", marginTop: 12 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="relative rounded-xl bg-card border border-primary/10 p-3 shadow-lg overflow-hidden group">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px] dark:bg-[radial-gradient(#fff_1px,transparent_1px)]" />
            
            {/* Active Indicator Pulse */}
            <div className="absolute top-0 right-0 p-2">
              <div className="relative flex items-center justify-center size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500"></span>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-3 gap-2">
              {/* Files Stat */}
              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-1.5 mb-1 text-muted-foreground/60">
                  <FileText className="size-3" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Files</span>
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-bold text-foreground">{stats.files}</span>
                  <span className="text-[9px] text-muted-foreground/40">/∞</span>
                </div>
              </div>

              {/* Seeds Stat */}
              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-1.5 mb-1 text-muted-foreground/60">
                  <Sprout className="size-3" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Seeds</span>
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-bold text-foreground">{stats.seeds}</span>
                  <span className="text-[9px] text-muted-foreground/40">/14m</span>
                </div>
              </div>

              {/* Tokens Stat */}
              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-1.5 mb-1 text-muted-foreground/60">
                  <Database className="size-3" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Tokens</span>
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-bold text-foreground">
                    {stats.tokens >= 1000 ? `${(stats.tokens / 1000).toFixed(1)}k` : stats.tokens}
                  </span>
                  <span className="text-[9px] text-muted-foreground/40">/16b</span>
                </div>
              </div>
            </div>

            {/* Agent Status Text */}
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[9px] text-emerald-500/80 font-medium">
              <Sparkles className="size-2.5" />
              <span>Garden Active & Monitoring</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

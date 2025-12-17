"use client";

import React, { useState, useRef, useMemo } from "react";
import { motion, useMotionValue, useSpring, useTransform, MotionValue, AnimatePresence } from "framer-motion";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import { SpecializedModel } from "@/types/AiModel";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAIContext } from "@/context/AIContext";
import { useTheme } from "next-themes"; 
import { Check } from "lucide-react"; // ← Para mostrar modelo seleccionado

const BASE_WIDTH = 40;
const DISTANCE = 140;
const MAGNIFICATION = 50;

interface ProviderGroup {
  provider: string;
  models: SpecializedModel[];
  icon: { light: string; dark: string };
}

function DockIcon({
  mouseX,
  providerGroup,
  isProviderSelected,
  onSelectModel,
  selectedModelIds,
  onMenuHover, // ← Nuevo: Callback para detener animación
}: {
  mouseX: MotionValue;
  providerGroup: ProviderGroup;
  isProviderSelected: boolean;
  onSelectModel: (model: SpecializedModel) => void;
  selectedModelIds: string[]; // ← Cambiado: Array de IDs seleccionados
  onMenuHover: (isHovering: boolean) => void; // ← Nuevo
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const { resolvedTheme } = useTheme();

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-DISTANCE, 0, DISTANCE], [BASE_WIDTH, MAGNIFICATION, BASE_WIDTH]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 });

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !ref.current?.contains(relatedTarget)) {
      setIsHovered(false);
    }
  };


  const handleMenuMouseEnter = () => {
    onMenuHover(true); 
  };

  const handleMenuMouseLeave = () => {
    onMenuHover(false); 
  };

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      className="relative flex flex-col items-center justify-end group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }} 
            animate={{ opacity: 1, y: 10, scale: 1 }}      
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            onMouseEnter={handleMenuMouseEnter}
            onMouseLeave={handleMenuMouseLeave}
            className="absolute top-full mt-2 p-2 bg-popover/95 backdrop-blur-md border border-border/50 shadow-xl rounded-xl flex flex-col gap-1 min-w-[180px] z-50"
            style={{ x: "-50%", left: "50%" }}
          >
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {providerGroup.provider} Models
            </div>
            {providerGroup.models.map((model) => {
              const selectedCount = selectedModelIds.filter(id => id === model.id).length;
              const isModelSelected = selectedCount > 0;
              
              return (
                <button
                  key={model.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectModel(model);
                  }}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg text-left transition-colors text-sm w-full",
                    isModelSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  <div className="relative w-6 h-6 shrink-0">
                    <Image
                      src={resolvedTheme === "dark" ? model.icon.light : model.icon.dark}
                      alt={model.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className="truncate flex-1">{model.name}</span>
                  
                  { isModelSelected && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {selectedCount > 1 && (
                        <span className="text-xs bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {selectedCount}
                        </span>
                      )}
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "w-full aspect-square rounded-full flex items-center justify-center cursor-pointer transition-colors duration-200",
          isProviderSelected ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-accent"
        )}
      >
        <div className="relative w-full h-full p-2">
          <Image 
            src={resolvedTheme === "dark" ? providerGroup.icon.light : providerGroup.icon.dark}
            alt={providerGroup.provider} 
            fill 
            className="object-contain pointer-events-none" 
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function AiDock() {
  const mouseX = useMotionValue(Infinity);
  const [isMenuHovered, setIsMenuHovered] = useState(false); 
  
  // Use the state from the context
  const { selectedModels, toggleModel, isModelSelected } = useAIContext();

  // Group reasoning models by provider
  const providerGroups = useMemo(() => {
    const groups: Record<string, ProviderGroup> = {};
    
    SPECIALIZED_MODELS.filter(m => m.category === "reasoning").forEach(model => {
      if (!groups[model.provider]) {
        groups[model.provider] = {
          provider: model.provider,
          models: [],
          icon: model.icon
        };
      }
      groups[model.provider].models.push(model);
    });

    return Object.values(groups);
  }, []);

  // Get selected model IDs
  const selectedModelIds = useMemo(() => {
    return selectedModels.map(m => m.modelId);
  }, [selectedModels]);

  return (
    <motion.div
      onMouseMove={(e) => {
        if (!isMenuHovered) {
          mouseX.set(e.pageX);
        }
      }}
      onMouseLeave={() => {
      
        if (!isMenuHovered) {
          mouseX.set(Infinity);
        }
      }}
      className="mx-auto flex h-16 items-end gap-4 rounded-2xl bg-background/50 px-4 pb-3 border shadow-sm"
    >
      {providerGroups.map((group) => {
        // Verify if any model of the provider is selected
        const isProviderSelected = group.models.some(m => isModelSelected(m.id));
        
        return (
          <DockIcon
            key={group.provider}
            providerGroup={group}
            mouseX={mouseX}
            isProviderSelected={isProviderSelected}
            onSelectModel={toggleModel}
            selectedModelIds={selectedModelIds}
            onMenuHover={setIsMenuHovered} 
          />
        );
      })}
    </motion.div>
  );
}
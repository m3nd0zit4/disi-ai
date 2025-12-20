"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAIContext } from "@/context/AIContext";
import { useTheme } from "next-themes";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import { SelectedModel } from "@/types/AiModel";
import { Check, X, Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ModelItemProps {
  model: SelectedModel;
  index: number;
}

function ModelItem({ model, index }: ModelItemProps) {
  const { 
    removeModelInstance, 
    toggleSpecializedModel, 
    isSpecializedModelSelected,
    getAllSpecializedModels,
    toggleModelEnabled,
  } = useAIContext();
  const { resolvedTheme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const showMenu = (isHovered || isFocused) && model.isEnabled;

  const mainModel = SPECIALIZED_MODELS.find(m => m.id === model.modelId);
  if (!mainModel) return null;

  const selectedSpecialized = SPECIALIZED_MODELS.filter(m => 
    model.specializedModels?.includes(m.id)
  );

  const allSpecialized = getAllSpecializedModels();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsFocused(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setIsFocused(false);
          setIsHovered(false);
        }
      }}
      aria-haspopup="menu"
      aria-expanded={showMenu}
      className={cn(
        "relative flex items-center gap-2 p-1.5 px-3 rounded-full border transition-all duration-200 group",
        model.isEnabled 
          ? (showMenu ? "border-primary/50 shadow-md bg-background/80" : "border-border bg-background/50")
          : "border-muted-foreground/20 bg-muted/50 opacity-60 grayscale",
        "backdrop-blur-sm"
      )}
    >
      {/* Enable/Disable Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleModelEnabled(index);
        }}
        className={cn(
          "p-1 rounded-full transition-colors",
          model.isEnabled 
            ? "text-primary hover:bg-primary/10" 
            : "text-muted-foreground hover:bg-muted"
        )}
        title={model.isEnabled ? "Desactivar modelo" : "Activar modelo"}
      >
        {model.isEnabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
      </button>

      {/* Main Model Icon */}
      <div className="relative w-5 h-5 shrink-0">
        <Image
          src={resolvedTheme === "dark" ? mainModel.icon.light : mainModel.icon.dark}
          alt={mainModel.name}
          fill
          className="object-contain"
        />
      </div>

      {/* Specialized Model Icons */}
      {selectedSpecialized.length > 0 && (
        <div className="flex items-center -space-x-2 ml-1">
          {selectedSpecialized.map((sm) => (
            <div key={sm.id} className="relative w-4 h-4 rounded-full border border-background bg-background p-0.5" title={sm.name}>
              <Image
                src={resolvedTheme === "dark" ? sm.icon.light : sm.icon.dark}
                alt={sm.name}
                fill
                className="object-contain"
              />
            </div>
          ))}
        </div>
      )}

      <span className="text-xs font-medium truncate max-w-[100px]">{mainModel.name}</span>

      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeModelInstance(index);
        }}
        className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Hover Menu for Specialized Models */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            role="menu"
            aria-label={`Opciones para ${mainModel.name}`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-full mb-3 left-0 p-2 bg-popover/95 backdrop-blur-md border border-border shadow-xl rounded-xl min-w-[220px] z-50"
          >
            <div className="px-2 py-1.5 mb-1 border-b">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Añadir Especializado</p>
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar">
              {allSpecialized.map((sm) => {
                const isSelected = isSpecializedModelSelected(index, sm.id);
                return (
                  <button
                    key={sm.id}
                    onClick={() => toggleSpecializedModel(index, sm)}
                    className={cn(
                      "flex items-center gap-2 w-full p-2 rounded-lg text-left text-xs transition-colors",
                      isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"
                    )}
                    role="menuitemcheckbox"
                    aria-checked={isSelected}
                  >
                    <div className="relative w-5 h-5 shrink-0">
                      <Image
                        src={resolvedTheme === "dark" ? sm.icon.light : sm.icon.dark}
                        alt={sm.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                            <span className="truncate">{sm.name}</span>
                            {sm.premium && <Badge variant="secondary" className="text-[8px] h-3 px-1">PRO</Badge>}
                        </div>
                    </div>
                    {isSelected && <Check className="w-3 h-3 text-primary" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ModelSelector() {
  const { selectedModels } = useAIContext();

  if (selectedModels.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2 px-1">
      <AnimatePresence mode="popLayout">
        {selectedModels.map((model, index) => (
          <ModelItem 
            key={`${model.modelId}-${index}`} 
            model={model} 
            index={index} 
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, MotionValue, Reorder } from "framer-motion";
import AI_MODELS from "@/shared/AiModelList";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

// Constants for the dock effect - Smaller icons 
const BASE_WIDTH = 40;
const DISTANCE = 140;
const MAGNIFICATION = 60;
const MAX_VISIBLE_ITEMS = 8;

function DockIcon({
  mouseX,
  src,
  alt,
  isSelected,
  onClick,
  item,
}: {
  mouseX: MotionValue;
  src?: string;
  alt: string;
  isSelected: boolean;
  onClick: () => void;
  item: any;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-DISTANCE, 0, DISTANCE], [BASE_WIDTH, MAGNIFICATION, BASE_WIDTH]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 });

  return (
    <Reorder.Item
      value={item}
      id={item.model}
      style={{ width }}
      ref={ref}
      className={cn(
        "aspect-square rounded-full flex items-center justify-center cursor-pointer transition-colors duration-200",
        isSelected ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-accent"
      )}
      onClick={onClick}
      whileDrag={{ scale: 1.1 }}
    >
      {src ? (
        <div className="relative w-full h-full p-2">
            <Image src={src} alt={alt} fill className="object-contain pointer-events-none" />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted rounded-full">
            <span className="text-xs font-bold">{alt[0]}</span>
        </div>
      )}
    </Reorder.Item>
  );
}

function MoreIcon({ mouseX }: { mouseX: MotionValue }) {
    const ref = useRef<HTMLDivElement>(null);
  
    const distance = useTransform(mouseX, (val) => {
      const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
      return val - bounds.x - bounds.width / 2;
    });
  
    const widthSync = useTransform(distance, [-DISTANCE, 0, DISTANCE], [BASE_WIDTH, MAGNIFICATION, BASE_WIDTH]);
    const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 });
  
    return (
      <motion.div
        ref={ref}
        style={{ width }}
        className="aspect-square rounded-full flex items-center justify-center cursor-pointer hover:bg-accent bg-muted text-muted-foreground"
      >
        <Plus className="w-1/2 h-1/2" />
      </motion.div>
    );
  }

export default function AiDock() {
  const mouseX = useMotionValue(Infinity);
  // Initialize with all models, but we will only render visible ones in the dock if needed, 
  // or maybe the user wants to reorder ALL of them? 
  // For now, let's stick to the visible slice logic but allow reordering within that slice.
  // Actually, if we reorder, we probably want to reorder the underlying list.
  
  const [items, setItems] = useState(AI_MODELS.slice(0, MAX_VISIBLE_ITEMS));
  const [selectedModels, setSelectedModels] = useState<string[]>(AI_MODELS[0]?.model ? [AI_MODELS[0].model] : []);

  const hasMore = AI_MODELS.length > MAX_VISIBLE_ITEMS;

  const toggleSelection = (model: string) => {
    setSelectedModels((prev) => 
      prev.includes(model) 
        ? prev.filter((m) => m !== model) 
        : [...prev, model]
    );
  };

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className="mx-auto flex h-16 items-end gap-4 rounded-2xl bg-background/50 px-4 pb-3 border shadow-sm"
    >
      <Reorder.Group 
        axis="x" 
        values={items} 
        onReorder={setItems} 
        className="flex items-end gap-4"
      >
        {items.map((model) => (
          <DockIcon
            key={model.model}
            item={model}
            mouseX={mouseX}
            src={model.icon}
            alt={model.model}
            isSelected={selectedModels.includes(model.model)}
            onClick={() => toggleSelection(model.model)}
          />
        ))}
      </Reorder.Group>
      {hasMore && <MoreIcon mouseX={mouseX} />}
    </motion.div>
  );
}

"use client";

import React from "react";
import { TOOLS_REGISTRY } from "./ToolsRegistry";
import { ToolActionButton } from "./ToolActionButton";
import { useAIContext } from "@/context/AIContext";

export function ToolActionsBar() {
  const { hasModelsSelected } = useAIContext();

  if (!hasModelsSelected) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mask-linear-fade">
      {TOOLS_REGISTRY.map((tool) => (
        <ToolActionButton key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

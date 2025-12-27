"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ToolDefinition } from "./ToolsRegistry";
import { useAIContext } from "@/context/AIContext";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import { checkToolSupport } from "./tool-utils";

interface ToolActionButtonProps {
  tool: ToolDefinition;
}

export function ToolActionButton({ tool }: ToolActionButtonProps) {
  const { selectedModels, isToolEnabled, toggleToolEnabled } = useAIContext();
  const isEnabled = isToolEnabled(tool.id);


  // Determine which selected models support this tool
  const supportedModels = selectedModels.map(selected => {
    const modelDef = SPECIALIZED_MODELS.find(m => m.id === selected.modelId);
    if (!modelDef) return null;

    return checkToolSupport(modelDef, tool) ? modelDef : null;
  }).filter(Boolean);

  const isSupported = supportedModels.length > 0;

  if (!isSupported) return null;

  const Icon = tool.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isEnabled ? "default" : "outline"}
            size="sm"
            className={cn(
              "rounded-full h-8 px-3 gap-1.5 transition-all text-xs font-medium",
              isEnabled 
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" 
                : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-dashed"
            )}
            onClick={() => toggleToolEnabled(tool.id)}

          >
            <Icon size={14} />
            {tool.label}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] p-3">
          <div className="space-y-2">
            <div>
              <p className="font-semibold text-xs">{tool.label}</p>
              <p className="text-[10px] text-muted-foreground">{tool.description}</p>
            </div>
            <div className="pt-2 border-t">
              <p className="text-[10px] font-medium mb-1 text-muted-foreground">Supported by:</p>
              <div className="flex flex-wrap gap-1">
                {supportedModels.map((m) => (
                  <span key={m?.id} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground">
                    {m?.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

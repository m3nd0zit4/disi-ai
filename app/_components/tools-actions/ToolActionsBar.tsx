"use client";

import { useAIContext } from "@/context/AIContext";
import { 
  Search, 
  Code, 
  Globe, 
  Image as ImageIcon,
  Zap,
  HelpCircle
} from "lucide-react";
import { LucideIcon } from "lucide-react";

const toolIcons: Record<string, LucideIcon> = {
  web_search: Search,
  code_interpreter: Code,
  browser: Globe,
  image_gen: ImageIcon,
  agent: Zap,
};

export function ToolActionsBar() {
  const { enabledTools } = useAIContext();
  
  const activeTools = Object.entries(enabledTools)
    .filter(([, enabled]) => enabled)
    .map(([id]) => ({ id, name: id.replaceAll('_', ' ') }));

  if (activeTools.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {activeTools.map((tool) => {
        const Icon = toolIcons[tool.id as keyof typeof toolIcons] || HelpCircle;
        return (
          <div
            key={tool.id}
            className="flex items-center justify-center size-6 rounded-lg bg-primary/5 text-primary/60"
            title={tool.name}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        );
      })}
    </div>
  );
}

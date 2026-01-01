"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Wand2, 
  Globe, 
  Zap,
  ChevronDown,
  Search,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import NextImage from "next/image";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import { useAIContext } from "@/context/AIContext";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { SpecializedModel } from "@/types/AiModel";

const modes = [
  { id: "regular", name: "Regular", icon: Sparkles, color: "text-primary" },
  { id: "webpage", name: "Webpage", icon: Globe, color: "text-blue-500" },
  { id: "image", name: "Image", icon: ImageIcon, color: "text-purple-500" },
  { id: "video", name: "Video", icon: Video, color: "text-pink-500" },
  { id: "prompt_enhance", name: "Prompt Enhance", icon: Wand2, color: "text-orange-500" },
  { id: "agent_mode", name: "Agent Mode", icon: Zap, color: "text-yellow-500" },
];

export default function ModelSelector() {
  const { selectedModels, toggleModel, isModelSelected, reorderModels } = useAIContext();
  const [mode, setMode] = useState("regular");
  const [search, setSearch] = useState("");
  const [isMultiSelect, setIsMultiSelect] = useState(true);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredModels = useMemo(() => {
    return SPECIALIZED_MODELS.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || 
                           m.provider.toLowerCase().includes(search.toLowerCase());
      let category: string;
      if (mode === "image") {
        category = "image";
      } else if (mode === "video") {
        category = "video";
      } else {
        // Match both reasoning and standard models for other modes
        return matchesSearch && (m.category === "reasoning" || m.category === "standard");
      }
      return matchesSearch && m.category === category;
    });
  }, [mode, search]);

  const currentModel = selectedModels[0] || SPECIALIZED_MODELS[0];
  const modelInfo = 'modelId' in currentModel 
    ? SPECIALIZED_MODELS.find(m => m.id === currentModel.modelId) 
    : currentModel;

  const modelName = selectedModels.length > 1 
    ? `${selectedModels.length} models` 
    : (modelInfo?.name || "Select Model");
  const CurrentIcon = modes.find(m => m.id === mode)?.icon || Sparkles;

  const handleModelClick = (m: SpecializedModel) => {
    if (isMultiSelect) {
      toggleModel(m);
    } else {
      // Single select: replace all with this one
      reorderModels([{
        category: m.category,
        modelId: m.id,
        provider: m.provider,
        providerModelId: m.providerModelId,
        isEnabled: true,
        specializedModels: m.category === 'reasoning' ? [] : undefined,
      }]);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full bg-muted/40 hover:bg-muted/60 px-2.5 text-[11px] font-semibold transition-all border border-transparent hover:border-primary/10">
            <div className="flex items-center gap-1">
              <CurrentIcon className={cn("w-3 h-3", modes.find(m => m.id === mode)?.color)} />
              <span className="capitalize">{mode.replace('_', ' ')}</span>
            </div>
            <div className="w-px h-2.5 bg-border/50 mx-0.5" />
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground/80 truncate max-w-[80px]">{modelName}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-40" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[380px] p-0 bg-card/98 backdrop-blur-xl border-primary/5 rounded-xl overflow-hidden shadow-xl">
          <div className="flex h-[420px]">
            {/* Modes Sidebar */}
            <div className="w-[130px] border-r border-primary/5 bg-muted/20 p-1.5 space-y-0.5">
              <div className="px-2 py-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">Mode</div>
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                    mode === m.id ? "bg-primary/10 text-primary" : "hover:bg-primary/5 text-muted-foreground/80"
                  )}
                >
                  <m.icon className={cn("w-3.5 h-3.5", mode === m.id ? m.color : "opacity-40")} />
                  {m.name}
                </button>
              ))}
            </div>

            {/* Models List */}
            <div className="flex-1 flex flex-col">
              <div className="p-2.5 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search models"
                    className="w-full bg-muted/40 border-none rounded-lg py-1.5 pl-7 pr-2.5 text-[11px] focus:ring-1 focus:ring-primary/10 outline-none placeholder:text-muted-foreground/30"
                  />
                </div>
                
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="multi-select" className="text-[10px] font-medium text-muted-foreground/70">Multi-Select</Label>
                    <Switch 
                      id="multi-select" 
                      checked={isMultiSelect} 
                      onCheckedChange={setIsMultiSelect}
                      className="scale-[0.6] origin-left"
                    />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground/50">
                    {selectedModels.length} selected
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                {filteredModels.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <span className="text-[11px] text-muted-foreground/50">No models found</span>
                  </div>
                ) : (
                  filteredModels.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleModelClick(m)}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-2 rounded-lg text-left transition-all group",
                        isModelSelected(m.id) ? "bg-primary/5" : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-4 h-4 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                          <NextImage 
                            src={mounted && theme === 'dark' ? m.icon.light : m.icon.dark} 
                            alt={m.name}
                            fill
                            className="object-contain"
                          />
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className={cn("text-[11px] font-medium", isModelSelected(m.id) ? "text-primary" : "text-foreground/90")}>{m.name}</span>
                          <span className="text-[9px] text-muted-foreground/50">{m.provider}</span>
                        </div>
                      </div>
                      {isMultiSelect ? (
                        <Checkbox checked={isModelSelected(m.id)} className="size-3.5 rounded border-muted-foreground/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                      ) : (
                        isModelSelected(m.id) && <Check className="w-3 h-3 text-primary" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

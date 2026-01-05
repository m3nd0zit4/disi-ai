"use client";

import { 
  Settings2, 
  Maximize2, 
  Highlighter, 
  Layers, 
  FileImage,
  Check,
  LucideIcon,
  Hash,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { useAIContext } from "@/context/AIContext";
import { cn } from "@/lib/utils";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";

interface ConfigImageSelectorProps {
  imageSize: string;
  setImageSize: (size: string) => void;
  imageQuality: string;
  setImageQuality: (quality: string) => void;
  imageBackground: string;
  setImageBackground: (bg: string) => void;
  imageOutputFormat: string;
  setImageOutputFormat: (format: string) => void;
  imageN: number;
  setImageN: (n: number) => void;
  imageModeration: string;
  setImageModeration: (mod: string) => void;
}

export default function ConfigImageSelector({
  imageSize,
  setImageSize,
  imageQuality,
  setImageQuality,
  imageBackground,
  setImageBackground,
  imageOutputFormat,
  setImageOutputFormat,
  imageN,
  setImageN,
  imageModeration,
  setImageModeration,
}: ConfigImageSelectorProps) {
  const { selectedModels, hasModelsSelected } = useAIContext();
  
  const currentSelected = hasModelsSelected ? selectedModels[0] : null;
  const selectedModel = currentSelected 
    ? SPECIALIZED_MODELS.find(m => m.id === currentSelected.modelId)
    : null;

  const imageOptions = selectedModel?.providerMetadata?.provider === "GPT" 
    ? selectedModel.providerMetadata.metadata.imageGenerationOptions 
    : null;

  if (!imageOptions) return null;

  const renderOption = <T extends string | number>(
    currentValue: T, 
    options: T[] | undefined, 
    onSelect: (val: T) => void,
    label: string,
    Icon: LucideIcon
  ) => {
    if (!options || options.length === 0) return null;

    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-[11px] focus:bg-primary/5 focus:text-primary cursor-pointer">
          <Icon className="w-3.5 h-3.5 opacity-60" />
          <span className="flex-1">{label}</span>
          <span className="text-[10px] text-muted-foreground/60 capitalize">{currentValue || "Default"}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent className="min-w-[120px] bg-card/98 backdrop-blur-xl border-primary/5 rounded-lg shadow-xl p-1">
            {options.map((opt) => (
              <DropdownMenuItem
                key={opt}
                onClick={() => onSelect(opt)}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 text-[11px] rounded-md cursor-pointer transition-colors",
                  currentValue === opt ? "bg-primary/10 text-primary font-medium" : "hover:bg-primary/5"
                )}
              >
                <span className="capitalize">{opt}</span>
                {currentValue === opt && <Check className="w-3 h-3" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    );
  };

  const isDalle = imageOptions.modelType === "dalle";
  const isGptImage = imageOptions.modelType === "gpt-image";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 rounded-full bg-muted/40 hover:bg-muted/60 p-0 transition-all border border-transparent hover:border-primary/10"
          title="Image Settings"
        >
          <Settings2 className="w-3.5 h-3.5 text-muted-foreground/80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px] p-1 bg-card/98 backdrop-blur-xl border-primary/5 rounded-xl shadow-xl">
        <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">
          Image Configuration
        </div>
        
        {renderOption(imageSize, imageOptions.sizes, setImageSize, "Dimensions", Maximize2)}
        {renderOption(imageQuality, imageOptions.quality, setImageQuality, "Quality", Highlighter)}
        
        {isGptImage && (
          <>
            {renderOption(imageBackground, imageOptions.background, setImageBackground, "Background", Layers)}
            {renderOption(imageOutputFormat, imageOptions.output_format, setImageOutputFormat, "Format", FileImage)}
            {renderOption(imageN, imageOptions.n, setImageN, "Images (N)", Hash)}
            {renderOption(imageModeration, imageOptions.moderation, setImageModeration, "Moderation", ShieldCheck)}
          </>
        )}

        {isDalle && (
          <>
            {renderOption(imageN, imageOptions.n, setImageN, "Images (N)", Hash)}
          </>
        )}

        <DropdownMenuSeparator className="bg-primary/5 my-1" />
        
        <div className="px-2 py-1 text-[9px] text-muted-foreground/40 italic">
          Options vary by model
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

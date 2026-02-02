"use client";

import { 
  Maximize2, 
  Highlighter, 
  Hash
} from "lucide-react";
import { useAIContext } from "@/context/AIContext";
import { modelRegistry } from "@/shared/ai";
import { SelectorPill } from "./SelectorPill";

interface ConfigImageSelectorProps {
  imageSize: string;
  setImageSize: (size: string) => void;
  imageQuality: string;
  setImageQuality: (quality: string) => void;
  imageN: number;
  setImageN: (n: number) => void;
}

export default function ConfigImageSelector({
  imageSize,
  setImageSize,
  imageQuality,
  setImageQuality,
  imageN,
  setImageN,
}: ConfigImageSelectorProps) {
  const { selectedModels, hasModelsSelected } = useAIContext();
  
  const currentSelected = hasModelsSelected ? selectedModels[0] : null;
  const selectedModel = currentSelected
    ? modelRegistry.getById(currentSelected.modelId)
    : null;

  type ImageGenOptions = { 
    sizes?: string[]; 
    quality?: string[]; 
    n?: number[]; 
    modelType?: string 
  };
  
  const providerMeta = selectedModel?._providerMetadata as { 
    imageGenerationOptions?: ImageGenOptions 
  } | undefined;
  const imageOptions = providerMeta?.imageGenerationOptions;

  if (!imageOptions) return null;

  const isGemini = selectedModel?.provider === "google";

  return (
    <div className="flex items-center gap-1.5">
      {/* Dimensions - Always shown */}
      <SelectorPill
        value={imageSize}
        options={imageOptions.sizes}
        onSelect={setImageSize}
        label="Dimensions"
        icon={Maximize2}
      />

      {/* Quality - Both */}
      <SelectorPill
        value={imageQuality}
        options={imageOptions.quality}
        onSelect={setImageQuality}
        label="Quality"
        icon={Highlighter}
      />

      {/* Number of Images (N) - Both */}
      <SelectorPill
        value={imageN}
        options={imageOptions.n}
        onSelect={setImageN}
        label="Images (N)"
        icon={Hash}
      />
    </div>
  );
}

"use client";

import { 
  Maximize2, 
  Clock,
  Monitor
} from "lucide-react";
import { useAIContext } from "@/context/AIContext";
import { modelRegistry } from "@/shared/ai";
import { SelectorPill } from "./SelectorPill";

interface ConfigVideoSelectorProps {
  videoAspectRatio: string;
  setVideoAspectRatio: (ratio: string) => void;
  videoDuration: number;
  setVideoDuration: (duration: number) => void;
  videoResolution: string;
  setVideoResolution: (resolution: string) => void;
}

export default function ConfigVideoSelector({
  videoAspectRatio,
  setVideoAspectRatio,
  videoDuration,
  setVideoDuration,
  videoResolution,
  setVideoResolution,
}: ConfigVideoSelectorProps) {
  const { selectedModels, hasModelsSelected } = useAIContext();
  
  const currentSelected = hasModelsSelected ? selectedModels[0] : null;
  const selectedModel = currentSelected
    ? modelRegistry.getById(currentSelected.modelId)
    : null;

  type VideoGenOptions = { 
    aspectRatios?: string[]; 
    resolutions?: string[]; 
    durationSeconds?: number[];
    features?: {
        audioCues?: boolean;
        negativePrompt?: boolean;
    }
  };
  
  const providerMeta = selectedModel?._providerMetadata as { 
    metadata?: { videoGenerationOptions?: VideoGenOptions };
    videoGenerationOptions?: VideoGenOptions;
  } | undefined;
  
  const videoOptions = providerMeta?.metadata?.videoGenerationOptions || providerMeta?.videoGenerationOptions;

  if (!videoOptions) return null;

  return (
    <div className="flex items-center gap-1.5">
      <SelectorPill
        value={videoAspectRatio}
        options={videoOptions.aspectRatios}
        onSelect={setVideoAspectRatio}
        label="Aspect Ratio"
        icon={Maximize2}
      />
      <SelectorPill
        value={videoResolution}
        options={videoOptions.resolutions}
        onSelect={setVideoResolution}
        label="Resolution"
        icon={Monitor}
      />
      <SelectorPill
        value={videoDuration}
        options={videoOptions.durationSeconds}
        onSelect={setVideoDuration}
        label="Duration"
        icon={Clock}
        formatValue={(val: number) => `${val}s`}
      />
    </div>
  );
}

"use client";

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { ArrowUp, Mic, Plus, Github, Figma, FolderOpen } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAIContext } from "@/context/AIContext";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter, useParams } from "next/navigation";
import ModelSelector from "./chat/ModelSelector";
import ConfigImageSelector from "./chat/ConfigImageSelector";
import { ToolActionsBar } from "./tools-actions/ToolActionsBar";
import { useDialog } from "@/hooks/useDialog";
import { useCanvasStore } from "@/hooks/useCanvasStore";

import { useNodePreview } from "@/hooks/useNodePreview";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";

interface ChatInputBoxProps {
  canvasId?: Id<"canvas">;
}

export default function ChatInputBox({ canvasId: propCanvasId }: ChatInputBoxProps) {
  const { selectedModels, hasModelsSelected } = useAIContext();
  const router = useRouter();
  const params = useParams();
  
  const canvasId = propCanvasId || (params.canvasId as Id<"canvas">);

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [imageSize, setImageSize] = useState<string>("");
  const [imageQuality, setImageQuality] = useState<string>("");
  const [imageBackground, setImageBackground] = useState<string>("");
  const [imageOutputFormat, setImageOutputFormat] = useState<string>("");
  const [imageN, setImageN] = useState<number>(1);
  const [imageModeration, setImageModeration] = useState<string>("");

  const addMenuRef = useRef<HTMLDivElement>(null);
  const { showDialog } = useDialog();

  // Convex mutations
  const createCanvas = useMutation(api.canvas.createCanvas);

  // Use custom hook for preview logic
  const { handlePromptChange, cleanupPreview, previewNodeIdRef } = useNodePreview(prompt, setPrompt);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update defaults when model changes
  useEffect(() => {
    if (hasModelsSelected && selectedModels.length > 0) {
      const currentModel = selectedModels[0];
      const modelInfo = SPECIALIZED_MODELS.find(m => m.id === currentModel.modelId);
      
      if (modelInfo?.category === "image" && modelInfo.providerMetadata?.provider === "GPT") {
        const options = modelInfo.providerMetadata.metadata.imageGenerationOptions;
        if (!options) return;

        if (options.sizes && options.sizes.length > 0 && !imageSize) {
          setImageSize(options.sizes[0]);
        }
        if (options.quality && options.quality.length > 0 && !imageQuality) {
          setImageQuality(options.quality[0]);
        }

        if (options.modelType === "gpt-image") {
          if (options.background && options.background.length > 0 && !imageBackground) {
            setImageBackground(options.background[0]);
          }
          if (options.output_format && options.output_format.length > 0 && !imageOutputFormat) {
            setImageOutputFormat(options.output_format[0]);
          }
          if (options.moderation && options.moderation.length > 0 && !imageModeration) {
            setImageModeration(options.moderation[0]);
          }
        }
      }
    }
  }, [selectedModels, hasModelsSelected, imageSize, imageQuality, imageBackground, imageOutputFormat, imageN, imageModeration]);

  const isSubmittingRef = useRef(false);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading || isSubmittingRef.current) return;

    setIsLoading(true);
    isSubmittingRef.current = true;
    
    try {
      let currentCanvasId = canvasId;

      // Use selected models or default to the first available model if none selected
      const modelsToUse = hasModelsSelected ? selectedModels : [{
        category: "reasoning",
        modelId: "gpt-5.2",
        provider: "GPT",
        providerModelId: "gpt-5.2",
        isEnabled: true,
      }];

      // If there is no canvas, create a new one
      if (!currentCanvasId) {
        currentCanvasId = await createCanvas({
          name: prompt.slice(0, 30) || "New Workflow",
          nodes: [],
          edges: [],
        });
        
        console.log("Canvas creado: ", currentCanvasId);
      }

      // Determine parent node (selected node or last node)
      const currentNodes = useCanvasStore.getState().nodes;
      const selectedNode = currentNodes.find(n => n.selected && n.id !== previewNodeIdRef.current);
      const parentNodeId = selectedNode ? selectedNode.id : undefined;

      // Capture preview node position if it exists
      const previewNode = currentNodes.find(n => n.id === previewNodeIdRef.current);
      const previewPosition = previewNode?.position;

      // Create a new node ID for this message
      // Use the preview ID if it exists to maintain continuity, but strip the prefix
      const previewId = previewNodeIdRef.current;
      const newNodeId = previewId ? previewId.replace('preview-', '') : `node-${Date.now()}`;
      
      // Trigger AI execution via API
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          canvasId: currentCanvasId,
          prompt: prompt,
          models: modelsToUse,
          newNodeId: newNodeId,
          parentNodeId: parentNodeId, // Pass parent node ID
          position: previewPosition, // Pass preview position
          imageSize, // Pass selected image size
          imageQuality, // Pass selected image quality
          imageBackground,
          imageOutputFormat,
          imageN,
          imageModeration,
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process request");
      }

      // Clean input
      cleanupPreview();
      
      // Clear local state
      setPrompt("");

      if (!canvasId && currentCanvasId) {
        router.push(`/canvas/${currentCanvasId}`);
      }

    } catch (error) {
      console.error("Error sending message:", error);
      showDialog({
        title: "Error",
        description: error instanceof Error ? error.message : "The message could not be sent",
        type: "error"
      });
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const selectedModel = hasModelsSelected ? selectedModels[0] : null;
  const modelInfo = selectedModel ? SPECIALIZED_MODELS.find(m => m.id === selectedModel.modelId) : null;
  const isImageModel = modelInfo?.category === "image";
  const imageOptions = modelInfo?.providerMetadata?.provider === "GPT" 
    ? modelInfo.providerMetadata.metadata.imageGenerationOptions 
    : null;

  return (
    <div className="w-full relative z-50">
      <PromptInput
        isLoading={isLoading}
        value={prompt}
        onValueChange={handlePromptChange}
        onSubmit={handleSubmit}
        className="border-primary/5 bg-card/70 backdrop-blur-3xl relative z-10 w-full rounded-2xl border p-0 pt-0.5 shadow-xl"
      >
        <div className="flex flex-col">
          <div className="px-3 pt-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ModelSelector />
              
              {isImageModel && imageOptions && (
                <ConfigImageSelector 
                  imageSize={imageSize}
                  setImageSize={setImageSize}
                  imageQuality={imageQuality}
                  setImageQuality={setImageQuality}
                  imageBackground={imageBackground}
                  setImageBackground={setImageBackground}
                  imageOutputFormat={imageOutputFormat}
                  setImageOutputFormat={setImageOutputFormat}
                  imageN={imageN}
                  setImageN={setImageN}
                  imageModeration={imageModeration}
                  setImageModeration={setImageModeration}
                />
              )}
            </div>
            <ToolActionsBar />
          </div>

          <PromptInputTextarea
            placeholder="Ask anything..."
            className="min-h-[38px] pt-2 pl-3.5 text-sm leading-relaxed sm:text-sm md:text-sm placeholder:text-muted-foreground/20"
          />

          <PromptInputActions className="mt-1 flex w-full items-center justify-between gap-1.5 px-2.5 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="relative" ref={addMenuRef}>
                <PromptInputAction tooltip="Add Files">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-8 rounded-full transition-all duration-200 hover:bg-primary/5",
                      showAddMenu && "bg-primary text-primary-foreground rotate-45"
                    )}
                    onClick={() => setShowAddMenu(!showAddMenu)}
                  >
                    <Plus size={16} />
                  </Button>
                </PromptInputAction>

                {showAddMenu && (
                  <div className="absolute bottom-10 left-0 z-50 min-w-[180px] overflow-hidden rounded-xl border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95 duration-200 slide-in-from-bottom-2">
                    <div className="grid gap-0.5">
                      <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] hover:bg-muted transition-colors text-left">
                        <FolderOpen size={14} className="text-muted-foreground/60" />
                        <span>Upload Local</span>
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] hover:bg-muted transition-colors text-left">
                        <Github size={14} className="text-muted-foreground/60" />
                        <span>From GitHub</span>
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] hover:bg-muted transition-colors text-left">
                        <Figma size={14} className="text-muted-foreground/60" />
                        <span>From Figma</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <PromptInputAction tooltip="Voice input">
                <Button variant="ghost" size="icon" className="size-8 rounded-full hover:bg-primary/5">
                  <Mic size={16} />
                </Button>
              </PromptInputAction>

              <Button
                size="icon"
                disabled={!prompt.trim() || isLoading}
                onClick={handleSubmit}
                className="size-8 rounded-full bg-primary shadow-md shadow-primary/10 hover:shadow-primary/20 transition-all"
              >
                {!isLoading ? <ArrowUp size={16} /> : <span className="size-2.5 rounded-xs bg-white animate-pulse" />}
              </Button>
            </div>
          </PromptInputActions>
        </div>
      </PromptInput>
    </div>
  );
}

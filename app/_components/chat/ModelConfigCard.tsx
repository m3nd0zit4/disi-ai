'use client';

import React from 'react';
import { ModelResponse } from "@/types/ChatMessage";
import { ChevronUp, ChevronDown, Image as ImageIcon, Video as VideoIcon, Check, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageAvatar } from "@/components/ui/message";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAIContext } from "@/context/AIContext";
import { useTheme } from "next-themes";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import Image from "next/image";

import { DragControls } from "framer-motion";

interface ModelConfigCardProps {
  response: ModelResponse;
  modelIndex: number;
  isEnabled: boolean;
  dragControls: DragControls;
}

export function ModelConfigCard({
  response,
  modelIndex,
  isEnabled,
  dragControls,
}: ModelConfigCardProps) {
  const { 
    selectedModels,
    getModelsByProvider, 
    removeModelInstance, 
    toggleModelEnabled, 
    toggleSpecializedModel, 
    isSpecializedModelSelected,
  } = useAIContext();
  const { resolvedTheme } = useTheme();
  const [isSpecializedExpanded, setIsSpecializedExpanded] = React.useState(false);

  // Find the model definition
  const model = SPECIALIZED_MODELS.find(m => m.id === response.modelId);

  if (!model) return null;

  // Get available specialized models (image/video) from same provider
  const imageModels = model.category === 'reasoning'
    ? getModelsByProvider(model.provider).filter(m => m.category === 'image' && m.enabled)
    : [];

  const videoModels = model.category === 'reasoning'
    ? getModelsByProvider(model.provider).filter(m => m.category === 'video' && m.enabled)
    : [];

  const hasSpecializedModels = imageModels.length > 0 || videoModels.length > 0;

  // Get selected specialized models for preview
  const selectedSpecializedIds = selectedModels[modelIndex]?.specializedModels || [];
  const selectedSpecializedModels = SPECIALIZED_MODELS.filter(m => selectedSpecializedIds.includes(m.id));

  return (
    <div
      className={cn(
        "border rounded-lg transition-all duration-200 bg-muted/30 hover:bg-muted/50",
        !isEnabled && "opacity-50 grayscale"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Drag Handle */}
          <div 
            className="flex items-center text-muted-foreground/30 cursor-grab active:cursor-grabbing p-1 -ml-1 hover:text-muted-foreground/60 transition-colors"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Model Avatar */}
          <MessageAvatar
            src={resolvedTheme === "dark" ? model.icon.light : model.icon.dark}
            alt={model.name}
            fallback={model.name[0]}
            className="w-8 h-8 flex-shrink-0"
          />

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium">{model.name}</span>
              {model.premium && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  PRO
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{model.description}</span>
          </div>
        </div>

        {/* Config Mode Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isEnabled ? 'Activo' : 'Inactivo'}
            </span>
            <Switch
              checked={isEnabled}
              onCheckedChange={() => toggleModelEnabled(modelIndex)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            className="flex-shrink-0 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              removeModelInstance(modelIndex);
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Specialized Models Selection */}
      {hasSpecializedModels && (
        <div className="border-t">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSpecializedExpanded(!isSpecializedExpanded);
            }}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Modelos Especializados
                </p>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                  {imageModels.length + videoModels.length} disponibles
                </Badge>
              </div>

              {/* Preview of selected models when collapsed */}
              {!isSpecializedExpanded && selectedSpecializedModels.length > 0 && (
                <div className="flex items-center gap-1.5 border-l pl-3 ml-1">
                  {selectedSpecializedModels.map(sm => (
                    <div key={sm.id} className="relative w-4 h-4" title={sm.name}>
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
            </div>
            {isSpecializedExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {isSpecializedExpanded && (
            <div className="px-4 pb-4 space-y-3">
              <div className="bg-muted/50 border border-border/50 rounded-lg p-3 flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Opcional:</strong> Si solo deseas usar el modelo de razonamiento,
                  no selecciones ningún modelo especializado. Los modelos de imagen/video se ejecutarán
                  solo si los activas.
                </p>
              </div>

              <div className="space-y-2">
                {imageModels.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Generación de Imágenes</span>
                    </div>
                    <div className="grid gap-2">
                      {imageModels.map(imageModel => {
                        const isSelected = isSpecializedModelSelected(modelIndex, imageModel.id);

                        return (
                          <button
                            key={imageModel.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSpecializedModel(modelIndex, imageModel);
                            }}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left w-full",
                              isSelected
                                ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30"
                                : "hover:bg-accent border-border"
                            )}
                          >
                            <div className="relative w-7 h-7 flex-shrink-0">
                              <Image
                                src={resolvedTheme === "dark" ? imageModel.icon.light : imageModel.icon.dark}
                                alt={imageModel.name}
                                fill
                                className="object-contain"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{imageModel.name}</span>
                                {imageModel.premium && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                    PRO
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {imageModel.description}
                              </p>
                              {imageModel.metadata?.qualityResolutions && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1 inline-block">
                                  {imageModel.metadata.qualityResolutions[0]}
                                </span>
                              )}
                            </div>

                            {isSelected && (
                              <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {videoModels.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <VideoIcon className="w-3.5 h-3.5" />
                      <span>Generación de Video</span>
                    </div>
                    <div className="grid gap-2">
                      {videoModels.map(videoModel => {
                        const isSelected = isSpecializedModelSelected(modelIndex, videoModel.id);

                        return (
                          <button
                            key={videoModel.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSpecializedModel(modelIndex, videoModel);
                            }}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left w-full",
                              isSelected
                                ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30"
                                : "hover:bg-accent border-border"
                            )}
                          >
                            <div className="relative w-7 h-7 flex-shrink-0">
                              <Image
                                src={resolvedTheme === "dark" ? videoModel.icon.light : videoModel.icon.dark}
                                alt={videoModel.name}
                                fill
                                className="object-contain"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{videoModel.name}</span>
                                {videoModel.premium && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                    PRO
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {videoModel.description}
                              </p>
                              {videoModel.metadata?.maxDuration && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1 inline-block">
                                  Hasta {videoModel.metadata.maxDuration}s
                                </span>
                              )}
                            </div>

                            {isSelected && (
                              <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

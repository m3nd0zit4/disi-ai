'use client';

import React from 'react';
import { ModelResponse } from "@/types/ChatMessage";
import { ChevronUp, Clock, ChevronDown, Copy, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageAvatar, MessageContent, MessageActions, MessageAction } from "@/components/ui/message";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { StreamingText } from "./StreamingText";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import Image from "next/image";

interface ModelResponseCardProps {
  response: ModelResponse;
  onToggleExpansion?: () => void;
}

export function ModelResponseCard({
  response,
  onToggleExpansion,
}: ModelResponseCardProps) {
  const { resolvedTheme } = useTheme();

  // Find the model definition
  const model = SPECIALIZED_MODELS.find(m => m.id === response.modelId);

  if (!model) return null;

  return (
    <div
      className={cn(
        "border rounded-lg transition-all duration-200",
        response.isExpanded ? "bg-card shadow-sm" : "bg-muted/30 hover:bg-muted/50"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between p-4 gap-3",
          onToggleExpansion && "cursor-pointer"
        )}
        onClick={() => onToggleExpansion?.()}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
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
          </div>

          {/* State */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-1 justify-end mr-2">
            {response.isLoading ? (
              // Loading
              <span className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Generando...</span>
              </span>
            ) : response.error ? (
              // Error
              <span className="text-destructive">{response.error}</span>
            ) : (
              // Completed
              <>
                <span className="text-green-600 dark:text-green-400">
                  ✓ Completo
                </span>
                {response.responseTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {response.responseTime.toFixed(1)}s
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Button Expand/Collapse */}
        {onToggleExpansion && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpansion();
            }}
          >
            {response.isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Content Expandable */}
      {response.isExpanded && !response.isLoading && (
        <div className="px-4 pb-4 space-y-3 border-t">
          {/* Response using Markdown or StreamingText */}
          {response.status === "processing" ? (
            <div className="pt-4">
              <StreamingText content={response.content} isStreaming={true} />
            </div>
          ) : (
            <div className="pt-4">
              {response.mediaUrl ? (
                // Media Content
                <div className="rounded-lg overflow-hidden border bg-black/5">
                  {response.category === 'image' ? (
                    <Image
                      src={response.mediaUrl}
                      alt="Generated image"
                      width={512}
                      height={512}
                      className="w-full h-auto max-w-md mx-auto"
                    />
                  ) : response.category === 'video' ? (
                    <video src={response.mediaUrl} controls className="w-full h-auto max-w-md mx-auto" />
                  ) : null}
                </div>
              ) : (
                // Text Content
                <MessageContent markdown className="prose-sm max-w-none">
                  {response.content || "*Sin respuesta*"}
                </MessageContent>
              )}
            </div>
          )}

          {/* Actions */}
          {response.content && (
            <MessageActions className="pt-2 border-t">
              <MessageAction tooltip="Copy">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => navigator.clipboard.writeText(response.content)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </MessageAction>
              <MessageAction tooltip="Me gusta">
                <Button variant="ghost" size="icon-sm">
                  <ThumbsUp className="w-4 h-4" />
                </Button>
              </MessageAction>
              <MessageAction tooltip="No me gusta">
                <Button variant="ghost" size="icon-sm">
                  <ThumbsDown className="w-4 h-4" />
                </Button>
              </MessageAction>
            </MessageActions>
          )}
        </div>
      )}

      {/* Loading State */}
      {response.isExpanded && response.isLoading && response.status !== "processing" && (
        <div className="px-4 pb-4 pt-2 border-t">
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Generating response...</span>
          </div>
        </div>
      )}
    </div>
  );
}
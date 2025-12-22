'use client';

import React from 'react';
import { ModelResponse } from "@/types/ChatMessage";
import { Clock, Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageAvatar, MessageContent, MessageActions, MessageAction } from "@/components/ui/message";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { StreamingText } from "./StreamingText";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import { Image } from "@/components/ui/image";
import { Loader } from "@/components/ui/loader";
import { ChainOfThought, ChainOfThoughtStep, ChainOfThoughtTrigger, ChainOfThoughtContent } from "@/components/ui/chain-of-thought";
import { Source, SourceTrigger, SourceContent } from "@/components/ui/source";

import { useStreamingResponse } from "@/hooks/useStreamingResponse";

interface ModelResponseCardProps {
  response: ModelResponse;
}

export function ModelResponseCard({
  response,
}: ModelResponseCardProps) {
  const { resolvedTheme } = useTheme();
  
  // Use the streaming hook if the response is in processing status
  const { streamingContent, isStreaming } = useStreamingResponse(
    response._id || "", 
    response.status === "processing"
  );

  // Find the model definition
  const model = SPECIALIZED_MODELS.find(m => m.id === response.modelId);

  if (!model) return null;

  // Use streaming content if available, otherwise fallback to response content
  const displayContent = isStreaming && streamingContent 
    ? streamingContent 
    : response.content;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-row items-start gap-3 w-full">
        {/* Model Avatar */}
        <MessageAvatar
          src={resolvedTheme === "dark" ? model.icon.light : model.icon.dark}
          alt={model.name}
          className="h-6 w-6 mb-0.5"
        />

        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {/* Model Name & Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-primary">{model.name}</span>
            {model.premium && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1 leading-none bg-primary/10 text-primary border-none">
                PRO
              </Badge>
            )}
            {response.responseTime > 0 && !response.isLoading && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {response.responseTime.toFixed(1)}s
              </span>
            )}
          </div>

          {/* Content */}
          <div className="w-full">
            {response.isLoading && response.status !== "processing" ? (
              <div className="flex flex-col gap-3">
                <ChainOfThought>
                  <ChainOfThoughtStep defaultOpen>
                    <ChainOfThoughtTrigger>
                      Pensando...
                    </ChainOfThoughtTrigger>
                    <ChainOfThoughtContent>
                      <div className="py-2">
                        <Loader variant="wave" size="sm" />
                      </div>
                    </ChainOfThoughtContent>
                  </ChainOfThoughtStep>
                </ChainOfThought>
              </div>
            ) : response.error ? (
              <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                {response.error}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {response.status === "processing" ? (
                  <StreamingText content={displayContent} isStreaming={true} />
                ) : response.mediaUrl != null ? (
                  <div className="rounded-xl overflow-hidden border bg-black/5 shadow-sm">
                    {response.category === 'image' ? (
                      <Image
                        src={response.mediaUrl}
                        alt="Generated image"
                        className="w-full h-auto max-w-md mx-auto"
                      />
                    ) : response.category === 'video' ? (
                      <video src={response.mediaUrl} controls className="w-full h-auto max-w-md mx-auto" />
                    ) : null}
                  </div>
                ) : (
                  <MessageContent markdown className="prose-sm text-primary w-full max-w-none bg-transparent p-0">
                    {displayContent || "*Sin respuesta*"}
                  </MessageContent>
                )}

                {/* Sources */}
                {response.sources && response.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {response.sources.map((source, idx) => (
                      <Source key={idx} href={source.url}>
                        <SourceTrigger label={source.title} showFavicon />
                        <SourceContent 
                          title={source.title} 
                          description={source.description || source.url} 
                        />
                      </Source>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {!response.isLoading && displayContent && (
                  <MessageActions className="pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MessageAction tooltip="Copy">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => navigator.clipboard.writeText(displayContent)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </MessageAction>
                    <MessageAction tooltip="Me gusta">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </Button>
                    </MessageAction>
                    <MessageAction tooltip="No me gusta">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </Button>
                    </MessageAction>
                  </MessageActions>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
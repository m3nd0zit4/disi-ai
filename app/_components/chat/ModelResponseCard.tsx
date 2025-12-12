'use client';

import { ModelResponse } from "@/types/ChatMessage";
import { ChevronUp, Clock, ChevronDown, Copy, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageAvatar, MessageContent, MessageActions, MessageAction } from "@/components/ui/message";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAIContext } from "@/context/AIContext";
import { useTheme } from "next-themes";
import { StreamingText } from "./StreamingText";

interface ModelResponseCardProps {
  response: ModelResponse;
  onToggleExpansion?: () => void;
  showContent?: boolean; // Para diferenciar entre modo config y modo respuesta
}

export function ModelResponseCard({
  response,
  onToggleExpansion,
  showContent = true, // Por defecto muestra contenido (modo respuesta)
}: ModelResponseCardProps) {
  const { getModelInfo, changeSubModel } = useAIContext();
  const model = getModelInfo(response.modelId);
  const { resolvedTheme } = useTheme();

  if (!model) return null;

  const currentSubModel = model.subModel.find(sm => sm.id === response.subModelId);

  return (
    <div
      className={cn(
        "border rounded-lg transition-all duration-200",
        response.isExpanded ? "bg-card shadow-sm" : "bg-muted/30 hover:bg-muted/50"
      )}
    >
      {/* Header - Siempre visible */}
      <div
        className={cn(
          "flex items-center justify-between p-4 gap-3",
          showContent && onToggleExpansion && "cursor-pointer"
        )}
        onClick={() => showContent && onToggleExpansion?.()}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Model Avatar */}
          <MessageAvatar
            src={resolvedTheme === "dark" ? model.iconLight : model.iconDark}
            alt={model.model}
            fallback={model.model[0]}
            className="w-8 h-8 flex-shrink-0"
          />

          {/* Select Sub-Model */}
          <Select
            value={response.subModelId}
            onValueChange={(subModelId) => changeSubModel(response.modelId, subModelId)}
          >
            <SelectTrigger
              className="w-[200px] h-8"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {model.subModel.map((sm) => (
                <SelectItem key={sm.id} value={sm.id}>
                  <div className="flex items-center gap-2">
                    <span>{sm.name}</span>
                    {sm.premium && (
                      <Badge variant="secondary" className="text-xs">
                        PRO
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Estado */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-1">
            {!showContent ? (
              // Modo Config (PRE-mensaje)
              <span className="text-green-600 dark:text-green-400">
                ✓ Listo para responder
              </span>
            ) : response.isLoading ? (
              // Cargando
              <span className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Generando...</span>
              </span>
            ) : response.error ? (
              // Error
              <span className="text-destructive">{response.error}</span>
            ) : (
              // Completo
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

        {/* Botón Expandir/Colapsar (solo en modo respuesta) */}
        {showContent && onToggleExpansion && (
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

      {/* Contenido Expandible (solo en modo respuesta) */}
      {showContent && response.isExpanded && !response.isLoading && (
        <div className="px-4 pb-4 space-y-3 border-t">
          {/* Respuesta usando Markdown o StreamingText */}
          {response.status === "processing" ? (
             <div className="pt-4">
                <StreamingText content={response.content} isStreaming={true} />
             </div>
          ) : (
            <MessageContent markdown className="pt-4 prose-sm max-w-none">
                {response.content || "*Sin respuesta*"}
            </MessageContent>
          )}

          {/* Acciones */}
          {response.content && (
            <MessageActions className="pt-2 border-t">
              <MessageAction tooltip="Copiar">
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

      {/* Loading State (solo en modo respuesta) */}
      {showContent && response.isExpanded && response.isLoading && response.status !== "processing" && (
        <div className="px-4 pb-4 pt-2 border-t">
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Generando respuesta...</span>
          </div>
        </div>
      )}
    </div>
  );
}
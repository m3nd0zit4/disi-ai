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
import { SearchButton } from "./actions/SearchButton";
import { DeepThoughtButton } from "./actions/DeepThoughtButton";
import { ImageButton } from "./actions/ImageButton";
import { VideoButton } from "./actions/VideoButton";
import { useAIContext } from "@/context/AIContext";
import { useCommonTools } from "@/hooks/useCommonTools";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";

interface ChatInputBoxProps {
  conversationId?: Id<"conversations">;
}

export default function ChatInputBox({ conversationId }: ChatInputBoxProps) {
  const { selectedModels, hasModelsSelected } = useAIContext();
  const router = useRouter();

  // Pasar los submodelos completos (modelId + subModelId) al hook
  const commonCapabilities = useCommonTools(selectedModels);

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [activeMode, setActiveMode] = useState<"image" | "video" | "deepThought" | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addMenuRef = useRef<HTMLDivElement>(null);

  // Convex mutations
  const createConversation = useMutation(api.conversations.createConversation);
  const sendMessage = useMutation(api.messages.sendMessage);

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

  const handleSubmit = async () => {
    if (!prompt.trim() || !hasModelsSelected) return;

    setIsLoading(true);
    
    try {
      let currentConversationId = conversationId;

      // Si no hay conversación, crear una nueva
      if (!currentConversationId) {
        currentConversationId = await createConversation({
          models: selectedModels,
        });
        
        // Redirigir a la nueva conversación (opcional, depende del flujo)
        // router.push(`/c/${currentConversationId}`);
      }

      // Enviar mensaje
      await sendMessage({
        conversationId: currentConversationId,
        content: prompt,
        models: selectedModels,
      });

      setPrompt("");
      
      // Si creamos una nueva conversación, podríamos querer redirigir ahora
      if (!conversationId && currentConversationId) {
         router.push(`/c/${currentConversationId}`);
      }

    } catch (error) {
      console.error("Error sending message:", error);
      // TODO: Mostrar toast de error
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = (mode: "image" | "video" | "deepThought") => {
    setActiveMode((prev) => (prev === mode ? null : mode));
  };

  return (
    <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-3 pb-3 md:px-5 md:pb-5">
      <PromptInput
        isLoading={isLoading}
        value={prompt}
        onValueChange={setPrompt}
        onSubmit={handleSubmit}
        disabled={!hasModelsSelected}
        className="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
      >
        <div className="flex flex-col">
          <PromptInputTextarea
            placeholder={
              hasModelsSelected
                ? "Pregunta lo que quieras..."
                : "Selecciona un modelo en el dock primero..."
            }
            className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
            disabled={!hasModelsSelected}
          />

          <PromptInputActions className="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="relative" ref={addMenuRef}>
                <PromptInputAction tooltip="Add Files">
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "size-9 rounded-full transition-all duration-200",
                      showAddMenu && "bg-primary text-primary-foreground rotate-45"
                    )}
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    disabled={!hasModelsSelected}
                  >
                    <Plus size={18} />
                  </Button>
                </PromptInputAction>

                {showAddMenu && (
                  <div className="absolute bottom-12 left-0 z-50 min-w-[200px] overflow-hidden rounded-xl border bg-popover p-1 shadow-md animate-in fade-in zoom-in-95 duration-200 slide-in-from-bottom-2">
                    <div className="grid gap-0.5">
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors text-left">
                        <FolderOpen size={16} className="text-muted-foreground" />
                        <span>Upload Local</span>
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors text-left">
                        <Github size={16} className="text-muted-foreground" />
                        <span>From GitHub</span>
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors text-left">
                        <Figma size={16} className="text-muted-foreground" />
                        <span>From Figma</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {commonCapabilities?.search && (
                <SearchButton isActive={isSearchActive} onClick={() => setIsSearchActive(!isSearchActive)} />
              )}

              {commonCapabilities?.deepthought && (
                <DeepThoughtButton isActive={activeMode === "deepThought"} onClick={() => toggleMode("deepThought")} />
              )}

              {commonCapabilities?.image && (
                <ImageButton isActive={activeMode === "image"} onClick={() => toggleMode("image")} />
              )}

              {commonCapabilities?.video && (
                <VideoButton isActive={activeMode === "video"} onClick={() => toggleMode("video")} />
              )}
            </div>

            <div className="flex items-center gap-2">
              <PromptInputAction tooltip="Voice input">
                <Button variant="outline" size="icon" className="size-9 rounded-full" disabled={!hasModelsSelected}>
                  <Mic size={18} />
                </Button>
              </PromptInputAction>

              <Button
                size="icon"
                disabled={!prompt.trim() || isLoading || !hasModelsSelected}
                onClick={handleSubmit}
                className="size-9 rounded-full"
              >
                {!isLoading ? <ArrowUp size={18} /> : <span className="size-3 rounded-xs bg-white" />}
              </Button>
            </div>
          </PromptInputActions>
        </div>
      </PromptInput>
    </div>
  );
}
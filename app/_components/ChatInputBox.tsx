"use client"

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { Button } from "@/components/ui/button"
import {
  ArrowUp,
  Mic,
  Plus,
  Github,
  Figma,
  FolderOpen,
} from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { SearchButton } from "./actions/SearchButton"
import { CodeButton } from "./actions/CodeButton"
import { ImageButton } from "./actions/ImageButton"
import { VideoButton } from "./actions/VideoButton"
import { useAIContext } from "@/context/AIContext"
import { useCommonTools } from "@/hooks/useCommonTools"

export default function ChatInputBox() {
  const { selectedModels } = useAIContext()
  const commonCapabilities = useCommonTools(selectedModels)

  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  // State for active toggles
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [activeMode, setActiveMode] = useState<'code' | 'image' | 'video' | null>(null)
  
  // State for dropdowns
  const [showAddMenu, setShowAddMenu] = useState(false)


  const addMenuRef = useRef<HTMLDivElement>(null)

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleSubmit = () => {
    if (!prompt.trim()) return

    setIsLoading(true)

    // Simulate API call
    console.log("Processing:", prompt)
    setTimeout(() => {
      setPrompt("")
      setIsLoading(false)
    }, 1500)
  }

  const toggleMode = (mode: 'code' | 'image' | 'video') => {
    setActiveMode(prev => prev === mode ? null : mode)
  }

  return (
    <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-3 pb-3 md:px-5 md:pb-5">
      <PromptInput
        isLoading={isLoading}
        value={prompt}
        onValueChange={setPrompt}
        onSubmit={handleSubmit}
        className="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
      >
        <div className="flex flex-col">
          <PromptInputTextarea
            placeholder="Ask anything"
            className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
          />

          <PromptInputActions className="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-3">
            <div className="flex items-center gap-2">
              {/* Add Files Dropdown */}
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

              {/* Action Buttons */}
              {commonCapabilities?.search && (
                <SearchButton 
                  isActive={isSearchActive} 
                  onClick={() => setIsSearchActive(!isSearchActive)} 
                />
              )}
              
              {commonCapabilities?.code && (
                <CodeButton 
                  isActive={activeMode === 'code'} 
                  onClick={() => toggleMode('code')} 
                />
              )}
              
              {commonCapabilities?.image && (
                <ImageButton 
                  isActive={activeMode === 'image'} 
                  onClick={() => toggleMode('image')} 
                />
              )}
              
              {commonCapabilities?.video && (
                <VideoButton 
                  isActive={activeMode === 'video'} 
                  onClick={() => toggleMode('video')} 
                />
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <PromptInputAction tooltip="Voice input">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-full"
                >
                  <Mic size={18} />
                </Button>
              </PromptInputAction>

              <Button
                size="icon"
                disabled={!prompt.trim() || isLoading}
                onClick={handleSubmit}
                className="size-9 rounded-full"
              >
                {!isLoading ? (
                  <ArrowUp size={18} />
                ) : (
                  <span className="size-3 rounded-xs bg-white" />
                )}
              </Button>
            </div>
          </PromptInputActions>
        </div>
      </PromptInput>
    </div>
  )
}

import { PromptInputAction } from "@/components/ui/prompt-input"
import { Button } from "@/components/ui/button"
import { Video } from "lucide-react"
import { cn } from "@/lib/utils"

interface VideoButtonProps {
  isActive: boolean
  onClick: () => void
}

export function VideoButton({ isActive, onClick }: VideoButtonProps) {
  return (
    <PromptInputAction tooltip="Video">
      <Button
        variant={isActive ? "default" : "outline"}
        className={cn("rounded-full transition-all", isActive && "px-4")}
        onClick={onClick}
      >
        <Video size={18} />
        {isActive && <span className="ml-1">Video</span>}
      </Button>
    </PromptInputAction>
  )
}

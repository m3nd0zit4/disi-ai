import { PromptInputAction } from "@/components/ui/prompt-input"
import { Button } from "@/components/ui/button"
import { Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageButtonProps {
  isActive: boolean
  onClick: () => void
}

export function ImageButton({ isActive, onClick }: ImageButtonProps) {
  return (
    <PromptInputAction tooltip="Images">
      <Button
        variant={isActive ? "default" : "outline"}
        className={cn("rounded-full transition-all", isActive && "px-4")}
        onClick={onClick}
      >
        <ImageIcon size={18} />
        {isActive && <span className="ml-1">Images</span>}
      </Button>
    </PromptInputAction>
  )
}

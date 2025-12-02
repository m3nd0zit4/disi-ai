import { PromptInputAction } from "@/components/ui/prompt-input"
import { Button } from "@/components/ui/button"
import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchButtonProps {
  isActive: boolean
  onClick: () => void
}

export function SearchButton({ isActive, onClick }: SearchButtonProps) {
  return (
    <PromptInputAction tooltip="Search">
      <Button
        variant={isActive ? "default" : "outline"}
        className={cn("rounded-full transition-all", isActive && "px-4")}
        onClick={onClick}
      >
        <Globe size={18} />
        {isActive && <span className="ml-1">Search</span>}
      </Button>
    </PromptInputAction>
  )
}

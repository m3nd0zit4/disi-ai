import { PromptInputAction } from "@/components/ui/prompt-input"
import { Button } from "@/components/ui/button"
import { Code } from "lucide-react"
import { cn } from "@/lib/utils"

interface CodeButtonProps {
  isActive: boolean
  onClick: () => void
}

export function CodeButton({ isActive, onClick }: CodeButtonProps) {
  return (
    <PromptInputAction tooltip="Code">
      <Button
        variant={isActive ? "default" : "outline"}
        className={cn("rounded-full transition-all", isActive && "px-4")}
        onClick={onClick}
      >
        <Code size={18} />
        {isActive && <span className="ml-1">Code</span>}
      </Button>
    </PromptInputAction>
  )
}

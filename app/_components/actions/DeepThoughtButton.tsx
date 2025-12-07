import { PromptInputAction } from "@/components/ui/prompt-input"
import { Button } from "@/components/ui/button"
import { BrainCircuit } from "lucide-react"
import { cn } from "@/lib/utils"

interface DeepThoughtButtonProps {
  isActive: boolean
  onClick: () => void
}

export function DeepThoughtButton({ isActive, onClick }: DeepThoughtButtonProps) {
  return (
    <PromptInputAction tooltip="Deep Thought">
      <Button
        variant={isActive ? "default" : "outline"}
        className={cn("rounded-full transition-all", isActive && "px-4")}
        onClick={onClick}
      >
        <BrainCircuit size={18} />
        {isActive && <span className="ml-1">Deep Thought</span>}
      </Button>
    </PromptInputAction>
  )
}

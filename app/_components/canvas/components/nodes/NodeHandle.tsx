import { memo } from "react";
import { Handle, HandleProps, useConnection } from "@xyflow/react";
import { cn } from "@/lib/utils";

interface NodeHandleProps extends Omit<HandleProps, "className"> {
  className?: string;
}

export const NodeHandle = memo(({ className, type, ...props }: NodeHandleProps) => {
  const connection = useConnection();

  // Check if we're in the middle of connecting and this handle could be a valid target
  const isConnecting = connection.inProgress;
  const isValidTarget = isConnecting && type === "target";
  const isValidSource = isConnecting && type === "source" && !connection.fromHandle;
  const isActive = isValidTarget || isValidSource;

  return (
    <Handle
      {...props}
      type={type}
      className={cn(
        // Minimalist base styles - small and subtle
        "!w-2 !h-2 !border !border-border/30 !bg-muted/50",
        "transition-all duration-200 ease-out",
        // Default state - very subtle, almost invisible
        "!opacity-30",
        // Hover state - slightly larger and more visible
        "hover:!opacity-80 hover:!w-2.5 hover:!h-2.5 hover:!bg-primary/20 hover:!border-primary/40",
        // Active connecting state - pulse to show valid targets
        isActive && "!opacity-100 !bg-primary/40 !border-primary/60 !w-3 !h-3 animate-pulse",
        // When connecting, non-matching handles fade out completely
        isConnecting && !isActive && "!opacity-10",
        className
      )}
    />
  );
});

NodeHandle.displayName = "NodeHandle";

import { memo } from "react";
import { Handle, HandleProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

interface NodeHandleProps extends Omit<HandleProps, "className"> {
  className?: string;
}

export const NodeHandle = memo(({ className, ...props }: NodeHandleProps) => {
  return (
    <Handle
      {...props}
      className={cn(
        "!bg-foreground/10 !border-none !w-2 !h-2 transition-all duration-300 hover:!bg-primary/40 hover:scale-150",
        className
      )}
    />
  );
});

NodeHandle.displayName = "NodeHandle";

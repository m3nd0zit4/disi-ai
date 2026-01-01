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
        "!bg-primary/30 !border-none !w-3 !h-3 transition-all hover:!bg-primary/50 hover:scale-125",
        className
      )}
    />
  );
});

NodeHandle.displayName = "NodeHandle";

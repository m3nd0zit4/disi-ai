import { memo } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { InputNodeData } from "../../types";
import { User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/utils";
import { NodeHandle } from "./NodeHandle";

export const InputNode = memo(({ data, selected }: NodeProps) => {
  const { text, createdAt } = data as unknown as InputNodeData;

  return (
    <Card className={cn(
      "min-w-[300px] max-w-[450px] border border-primary/10 bg-secondary/50 dark:bg-card/90 backdrop-blur-xl transition-all duration-300 rounded-2xl overflow-hidden",
      selected ? "ring-2 ring-primary/50 border-primary/50 shadow-2xl shadow-primary/30 z-50" : "shadow-sm hover:border-primary/20"
    )}>
      <NodeHandle type="target" position={Position.Top} />
      
      <div className="p-4 space-y-3.5">
        <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed text-foreground/90 font-medium">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {text}
          </ReactMarkdown>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t border-primary/10">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded-lg bg-primary/10 flex items-center justify-center text-primary/70">
              <User className="w-2.5 h-2.5" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Me</span>
          </div>
          <div className="text-[9px] text-muted-foreground/40 font-medium">
            {createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : 'Just now'}
          </div>
        </div>
      </div>

      <NodeHandle type="source" position={Position.Bottom} />
    </Card>
  );
});

InputNode.displayName = "InputNode";

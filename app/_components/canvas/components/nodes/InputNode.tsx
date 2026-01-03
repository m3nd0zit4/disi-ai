import { memo } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/utils";
import { NodeHandle } from "./NodeHandle";
import { NodeToolbar } from "./NodeToolbar";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";

export const InputNode = memo(({ id, data, selected }: NodeProps) => {
  const { text, createdAt, color } = data as any;
  const { user } = useUser();

  return (
    <div className="relative">
      <NodeToolbar nodeId={id} isVisible={selected} data={data} />
      <Card 
        className={cn(
          "min-w-[300px] max-w-[450px] border border-primary/10 backdrop-blur-xl transition-all duration-300 rounded-2xl overflow-hidden",
          (!color || color === 'transparent') && "bg-secondary/50 dark:bg-card/90",
          selected ? "ring-2 ring-primary/50 border-primary/50 shadow-2xl shadow-primary/30 z-50" : "shadow-sm hover:border-primary/20"
        )}
        style={{ 
          backgroundColor: color && color !== 'transparent' ? color : undefined,
          borderColor: color && color !== 'transparent' ? color.replace('0.15', '0.5') : undefined
        }}
      >
      <NodeHandle type="target" position={Position.Top} />
      
      <div className="p-4 space-y-3.5">
        <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed text-foreground/90 font-medium">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {text}
          </ReactMarkdown>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t border-primary/10">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
              {user?.imageUrl ? (
                <Image 
                  src={user.imageUrl} 
                  alt={user.fullName || "User"} 
                  width={20} 
                  height={20} 
                  className="object-cover"
                />
              ) : (
                <User className="w-2.5 h-2.5 text-primary/70" />
              )}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
              {user?.firstName || "Me"}
            </span>
          </div>
          <div className="text-[9px] text-muted-foreground/40 font-medium">
            {createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : 'Just now'}
          </div>
        </div>
      </div>

      <NodeHandle type="source" position={Position.Bottom} />
      </Card>
    </div>
  );
});

InputNode.displayName = "InputNode";

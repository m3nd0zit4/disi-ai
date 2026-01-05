import { memo } from "react";
import { Position, NodeProps } from "@xyflow/react";
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
  console.log(`[InputNode ${id}] data:`, JSON.stringify(data));
  console.log(`[InputNode ${id}] text type:`, typeof text);
  console.log(`[InputNode ${id}] text value:`, text);
  const { user } = useUser();

  return (
    <div className="group relative select-none">
      <NodeToolbar nodeId={id} isVisible={selected} data={data} />
      <div 
        className={cn(
          "min-w-[280px] max-w-[420px] backdrop-blur-2xl transition-all duration-500 rounded-[2rem] overflow-hidden border border-primary/5 !border-0",
          (!color || color === 'transparent') && "bg-white/80 dark:bg-white/[0.08]",
          selected ? "ring-1 ring-primary/30 shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-50" : "shadow-sm hover:border-primary/10"
        )}
        style={{ 
          backgroundColor: color && color !== 'transparent' ? color : undefined,
          borderColor: color && color !== 'transparent' ? color.replace('0.15', '0.3') : undefined
        }}
      >
        <NodeHandle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <div className="p-6 space-y-4">
          <div className="prose prose-sm dark:prose-invert max-w-none text-[14px] leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap selection:bg-primary/20">
            {text}
          </div>
          
          <div className="flex items-center justify-between pt-2 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-2">
              <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
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
              <span className="text-[10px] font-medium tracking-tight text-muted-foreground">
                {user?.firstName || "Me"}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground/60 font-medium">
              {createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : 'Just now'}
            </div>
          </div>
        </div>

        <NodeHandle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
});

InputNode.displayName = "InputNode";

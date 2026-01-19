import React, { memo } from "react";
import { Position, NodeProps } from "@xyflow/react";
import { User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn, adjustAlpha } from "@/lib/utils";
import { NodeHandle } from "../NodeHandle";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { InputNodeData } from "../../../types";
import { useSignedUrl } from "@/hooks/useSignedUrl";

export const PreviewInputNode = memo(({ data, selected }: NodeProps) => {
  const inputData = data as unknown as InputNodeData;
  const { text, createdAt, color, attachments, role, importance } = inputData;
  const { user } = useUser();

  return (
    <div className="group relative select-none">
      <div 
        className={cn(
          "w-[350px] backdrop-blur-2xl transition-all duration-500 rounded-[2rem] overflow-hidden border border-primary/5",
          (!color || color === 'transparent') && "bg-white/80 dark:bg-white/[0.08]",
          selected ? "ring-1 ring-primary/30 shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-50" : "shadow-sm hover:border-primary/10"
        )}
        style={{ 
          backgroundColor: color && color !== 'transparent' ? color : undefined,
          borderColor: color && color !== 'transparent' ? adjustAlpha(color, 0.3) : undefined
        }}
      >
        <NodeHandle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <div className="p-6 space-y-4">
          <div className="prose prose-sm dark:prose-invert max-w-none text-[14px] leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap selection:bg-primary/20">
            {text || (
              <span className="text-foreground/30 italic font-normal">
                Escribe tu prompt aquí...
              </span>
            )}
          </div>

          {/* Attachments */}
          {attachments && attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {attachments?.map((file: { url?: string; storageId?: string; type?: string; name?: string }) => {
                return (
                  <AttachmentPreview key={file.storageId || file.url || file.name} file={file} />
                );
              })}
            </div>
          )}
          
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
              <div className="flex flex-col">
                <span className="text-[10px] font-medium tracking-tight text-foreground/70">
                  {user?.firstName || "Me"}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {role && role !== 'context' && (
                    <span className="text-[8px] px-1 py-0.5 rounded-md bg-primary/5 text-primary/50 font-bold uppercase tracking-tighter border border-primary/5">
                      {role}
                    </span>
                  )}
                  {importance && importance !== 3 && (
                    <span className="text-[8px] px-1 py-0.5 rounded-md bg-amber-500/5 text-amber-600/50 font-bold border border-amber-500/5">
                      IMP: {importance}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground/60 font-medium self-end pb-1">
              {createdAt && !isNaN(new Date(createdAt).getTime()) 
                ? formatDistanceToNow(createdAt, { addSuffix: true }) 
                : 'Just now'}
            </div>
          </div>
        </div>

        <NodeHandle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
});

PreviewInputNode.displayName = "PreviewInputNode";

function AttachmentPreview({ file }: { file: { url?: string; storageId?: string; type?: string; name?: string } }) {
  const signedUrl = useSignedUrl(file.storageId, file.url);

  if (!signedUrl) return <div className="h-20 w-20 bg-muted animate-pulse rounded-lg" />;

  return (
    <div className="relative group overflow-hidden rounded-lg border border-primary/10">
      {file.type?.startsWith("image/") || file.type === "image" ? (
        <div className="relative h-20 w-20">
          <Image 
            src={signedUrl} 
            alt={file.name || "Attachment"} 
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="h-20 w-20 flex items-center justify-center bg-muted text-xs p-2 text-center break-all">
          {file.name}
        </div>
      )}
    </div>
  );
}

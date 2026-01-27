import { Card } from "@/components/ui/card";
import { Loader2, Bean } from "lucide-react";
import { cn } from "@/lib/utils";

interface SeedCardProps {
  id: string;
  title: string;
  seedCount?: number;
  status: "uploading" | "uploaded" | "processing" | "ready" | "error";
  createdAt: number;
  onOpen: (id: string) => void;
  onPromote: (id: string) => void;
}

export function SeedCard({ id, title, seedCount, status, createdAt, onOpen }: SeedCardProps) {
  const isProcessing = status === "processing" || status === "uploading" || status === "uploaded";

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden border transition-all duration-300 cursor-pointer rounded-xl h-[320px] flex flex-col",
        "bg-card hover:bg-accent/5 border-border hover:border-border/50",
        isProcessing && "border-border/30"
      )}
      onClick={() => onOpen(id)}
    >
      {/* Header */}
      <div className="p-4 pb-2 z-10">
        <h3 className="text-sm font-bold text-card-foreground line-clamp-1" title={title}>
          {title}
        </h3>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative w-full">
        {/* Thumbnail / Preview */}
        <div className="absolute inset-0 p-4 pt-0 opacity-50 group-hover:opacity-70 transition-opacity">
           {/* Placeholder for document preview - using a generic gradient or pattern */}
           <div className="w-full h-full bg-gradient-to-br from-muted/50 to-transparent rounded-lg border border-border/50 p-4">
              <div className="w-full h-2 bg-muted rounded-full mb-2" />
              <div className="w-3/4 h-2 bg-muted rounded-full mb-2" />
              <div className="w-full h-2 bg-muted rounded-full mb-2" />
              <div className="w-5/6 h-2 bg-muted rounded-full" />
           </div>
        </div>

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
            <div className="flex items-center gap-2 text-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-bold">AI Extracting...</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
              Processing in cloud. ETA 1-4 mins.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 z-10 flex items-center justify-between">
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
          isProcessing ? "bg-muted/50 text-muted-foreground" : "bg-muted text-foreground group-hover:bg-muted/80"
        )}>
          {isProcessing ? (
            <>
              <Bean className="w-3.5 h-3.5 animate-pulse" />
              <span className="text-[10px] font-bold">counting...</span>
            </>
          ) : (
            <>
              <Bean className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">{seedCount || 0} Seed{seedCount !== 1 && 's'}</span>
            </>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">
          {new Date(createdAt).toLocaleDateString()}
        </span>
      </div>
    </Card>
  );
}

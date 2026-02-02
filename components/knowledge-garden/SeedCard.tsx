import { Card } from "@/components/ui/card";
import { Loader2, Bean } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingVisualCard } from "@/app/_components/ui/LoadingVisualCard";

import { useSignedUrl } from "@/hooks/useSignedUrl";

interface SeedCardProps {
  id: string;
  title: string;
  seedCount?: number;
  status: "uploading" | "uploaded" | "processing" | "ready" | "error";
  createdAt: number;
  onOpen: (id: string) => void;
  onPromote: (id: string) => void;
  s3Key?: string;
  fileType?: string;
}

export function SeedCard({ id, title, seedCount, status, createdAt, onOpen, s3Key, fileType }: SeedCardProps) {
  const isProcessing = status === "processing" || status === "uploading" || status === "uploaded";

  // Placeholder visual for the background
  const PlaceholderPreview = (
    <div className="w-full h-full bg-gradient-to-br from-muted/50 to-transparent p-4">
       <div className="w-full h-2 bg-muted/50 rounded-full mb-2" />
       <div className="w-3/4 h-2 bg-muted/50 rounded-full mb-2" />
       <div className="w-full h-2 bg-muted/50 rounded-full mb-2" />
       <div className="w-5/6 h-2 bg-muted/50 rounded-full" />
    </div>
  );

  const signedUrl = useSignedUrl(s3Key);
  const isImage = fileType?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(title);
  const isPdf = fileType === "application/pdf" || title.toLowerCase().endsWith(".pdf");

  return (
    <div
      className={cn(
        "relative grid h-[320px] w-full transform-gpu overflow-hidden rounded-xl border shadow-sm transition-all duration-300 ease-in-out group cursor-pointer",
        "bg-neutral-900",
        isProcessing && "border-border/30"
      )}
      onClick={() => onOpen(id)}
    >
      {isProcessing ? (
        <div className="relative w-full h-full">
           {/* Title Overlay */}
           <div className="absolute top-0 left-0 right-0 p-4 z-20">
             <h3 className="text-sm font-bold text-white/90 line-clamp-1 drop-shadow-md" title={title}>
               {title}
             </h3>
           </div>
           
           <LoadingVisualCard
             mode="kb"
             statusMessage={
               status === "uploading" ? "Uploading your wisdom..." :
               status === "processing" ? "Extracting knowledge magic..." :
               "Preparing your garden..."
             }
             backgroundVisual={PlaceholderPreview}
             className="border-none rounded-none"
           />
        </div>
      ) : (
        <>
          {/* Background Image/Preview with Hover Animation */}
          <div className="absolute inset-0 h-full w-full overflow-hidden bg-white">
            {signedUrl ? (
              isImage ? (
                <img
                  src={signedUrl}
                  alt={title}
                  className="absolute inset-0 h-full w-full object-cover top-[-5px] transition-transform duration-500 ease-in-out group-hover:scale-110 scale-105"
                />
              ) : isPdf ? (
                <div className="w-full h-full relative">
                   <iframe 
                    src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    className="absolute inset-0 w-full h-[105%] object-cover pointer-events-none border-none top-[-5px] scale-105 origin-top transition-transform duration-500 ease-in-out group-hover:scale-110"
                    title={title}
                    tabIndex={-1}
                  />
                  {/* Overlay to prevent interaction */}
                  <div className="absolute inset-0 bg-transparent" />
                </div>
              ) : (
                /* Fallback for other files */
                <div className="w-full h-full bg-white flex flex-col overflow-hidden relative">
                    <div className="space-y-4 opacity-20 scale-100 origin-top-left p-8 transition-transform duration-500 ease-in-out group-hover:scale-110">
                      <div className="w-3/4 h-6 bg-black rounded-sm" />
                      <div className="space-y-3">
                        <div className="w-full h-3 bg-black rounded-sm" />
                        <div className="w-full h-3 bg-black rounded-sm" />
                        <div className="w-5/6 h-3 bg-black rounded-sm" />
                        <div className="w-full h-3 bg-black rounded-sm" />
                        <div className="w-11/12 h-3 bg-black rounded-sm" />
                        <div className="w-full h-3 bg-black rounded-sm" />
                        <div className="w-4/5 h-3 bg-black rounded-sm" />
                        <div className="w-full h-3 bg-black rounded-sm" />
                      </div>
                    </div>
                </div>
              )
            ) : (
               <div className="w-full h-full bg-muted/20 flex items-center justify-center">
                 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
               </div>
            )}
          </div>

          {/* Dark Overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

          {/* Text Content with Hover Animation */}
          <div className="relative z-10 flex h-full flex-col justify-end p-6 text-white transition-transform duration-500 ease-in-out group-hover:-translate-y-2">
            <div className="flex items-center gap-2 mb-2">
               <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/20 backdrop-blur-sm">
                  <Bean className="w-3 h-3 text-white" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white">
                    {seedCount || 0} SEEDS
                  </p>
               </div>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-tight text-white line-clamp-2 drop-shadow-md">
              {title}
            </h2>
          </div>
        </>
      )}
    </div>
  );
}

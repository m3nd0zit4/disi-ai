"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { EditorCanvas } from "@/app/_components/canvas/components/Editor-Canvas";
import { ConnectionsProvider } from "@/app/_components/canvas/providers/ConnectionsProvider";
import { EditorProvider } from "@/app/_components/canvas/providers/EditorProvider";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { KnowledgePanel } from "@/app/_components/canvas/KnowledgePanel";
import ChatInputBox from "@/app/_components/ChatInputBox";
import { CanvasToolbar } from "@/app/_components/canvas/CanvasToolbar";

const CanvasPage = () => {
  const params = useParams();
  const canvasId = params.canvasId as Id<"canvas">;
  const canvas = useQuery(api.canvas.canvas.getCanvas, { canvasId });

  if (canvas === undefined) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Loading Canvas...
          </p>
        </div>
      </div>
    );
  }

  if (canvas === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-medium text-muted-foreground">
            Canvas not found
          </p>
        </div>
      </div>
    );
  }

  return (
    <EditorProvider>
      <ConnectionsProvider canvasId={canvasId}>
        <div className="relative w-full h-screen overflow-hidden">
          <EditorCanvas
            canvasId={canvasId}
            initialNodes={canvas.nodes}
            initialEdges={canvas.edges}
          />
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
            <CanvasToolbar />
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-50">
            <ChatInputBox canvasId={canvasId} />
          </div>
        </div>
      </ConnectionsProvider>
    </EditorProvider>
  );
};

export default CanvasPage;

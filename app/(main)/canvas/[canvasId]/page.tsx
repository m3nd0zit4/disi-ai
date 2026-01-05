"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { EditorProvider } from "@/app/_components/canvas/providers/EditorProvider";
import { ConnectionsProvider } from "@/app/_components/canvas/providers/ConnectionsProvider";
import { EditorCanvas } from "@/app/_components/canvas/components/Editor-Canvas";
import { Loader2 } from "lucide-react";
import ChatInputBox from "@/app/_components/ChatInputBox";
import { CanvasToolbar } from "@/app/_components/canvas/CanvasToolbar";
export default function CanvasPage() {
  const params = useParams();
  const canvasId = params.canvasId as Id<"canvas">;
  
  const canvas = useQuery(api.canvas.getCanvas, { canvasId });

  if (canvas === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (canvas === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Canvas not found or access denied.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden relative">
      <main className="flex-1 relative overflow-hidden w-full h-full">
        <div className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4 pointer-events-none">
          <div className="flex justify-center pointer-events-auto">
            <CanvasToolbar />
          </div>
        </div>
        <EditorProvider>
          <ConnectionsProvider canvasId={canvasId}>
            <EditorCanvas 
              initialNodes={canvas.nodes} 
              initialEdges={canvas.edges} 
            />
          </ConnectionsProvider>
        </EditorProvider>
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4 pointer-events-none">
          <div className="pointer-events-auto">
            <ChatInputBox canvasId={canvasId} />
          </div>
        </div>
      </main>
    </div>
  );
}

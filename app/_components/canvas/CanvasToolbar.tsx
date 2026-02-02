"use client";

import { Button } from "@/components/ui/button";
import {
  PanelLeft,
  MessageSquare,
  Plus,
  Search,
  FilePlus,
  Bean
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { Node } from "@xyflow/react";
import { useRef } from "react";
import { useDialog } from "@/hooks/useDialog";

import { isTextualFile, readFileAsText } from "@/lib/file-utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function CanvasToolbar() {
  const { toggleSidebar } = useSidebar();
  const { 
    addNode, 
    viewport, 
    nodes, 
    setNodes, 
    updateNodeData,
    isKnowledgePanelOpen,
    setKnowledgePanelOpen
  } = useCanvasStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showDialog } = useDialog();

  const handleAddFreeNode = () => {
    const newNodeId = `input-${Date.now()}`;
    
    let position = { x: 0, y: 0 };
    if (viewport) {
      position = {
        x: (-viewport.x + 400) / viewport.zoom,
        y: (-viewport.y + 100) / viewport.zoom, // Higher up
      };
    }

    const newNode: Node = {
      id: newNodeId,
      type: "input",
      position,
      selected: true,
      data: {
        text: "",
        createdAt: Date.now(),
      },
    };

    const updatedNodes = nodes.map(n => ({ ...n, selected: false }));
    setNodes([...updatedNodes, newNode]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    if (file.size > MAX_FILE_SIZE) {
      showDialog({ 
        title: "File Too Large", 
        description: `${file.name} exceeds 50MB limit.`, 
        type: "error" 
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const nodeId = `file-${Date.now()}`;

    
    let position = { x: 0, y: 0 };
    if (viewport) {
      position = {
        x: (-viewport.x + 450) / viewport.zoom,
        y: (-viewport.y + 150) / viewport.zoom, // Higher up
      };
    }

    let textContent: string | undefined;
    if (isTextualFile(file)) {
      try {
        textContent = await readFileAsText(file);
      } catch {
        textContent = undefined;
      }
    }

    const newNode: Node = {
      id: nodeId,
      type: "file",
      position,
      selected: true,
      data: {
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        storageId: "", 
        uploadStatus: "uploading",
        textContent,
        createdAt: Date.now(),
      },
    };

    const updatedNodes = nodes.map(n => ({ ...n, selected: false }));
    setNodes([...updatedNodes, newNode]);

    // Upload logic
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, fileName: file.name }),
      });

      if (!response.ok) throw new Error("Failed to get upload URL");
      const { url, key } = await response.json();

      const uploadResult = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResult.ok) throw new Error("Upload to S3 failed");
      
      updateNodeData(nodeId, { 
        storageId: key, 
        uploadStatus: "complete" 
      });
    } catch (error) {
      console.error("Upload error:", error);
      updateNodeData(nodeId, { uploadStatus: "error" });
      showDialog({ title: "Upload Error", description: `Failed to upload ${file.name}`, type: "error" });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-popover/80 backdrop-blur-xl border border-border shadow-2xl">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-xl text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[10px] py-1 px-2">
          Toggle Sidebar
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-xl text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all"
            aria-label="Messages"
          >
            <MessageSquare className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[10px] py-1 px-2">
          Messages
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-xl text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all"
            aria-label="Add new text node"
            onClick={handleAddFreeNode}
          >
            <Plus className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[10px] py-1 px-2">
          Add Text Node
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-xl text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all"
            aria-label="Add new file node"
            onClick={() => fileInputRef.current?.click()}
          >
            <FilePlus className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[10px] py-1 px-2">
          Add File
        </TooltipContent>
      </Tooltip>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-xl text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all"
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[10px] py-1 px-2">
          Search
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

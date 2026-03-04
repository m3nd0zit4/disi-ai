"use client";

import { Button } from "@/components/ui/button";
import { PanelLeft, Plus, Search, FilePlus } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { Node } from "@xyflow/react";
import { useRef, useState, useMemo } from "react";
import { useDialog } from "@/hooks/useDialog";
import { cn } from "@/lib/utils";
import { isTextualFile, readFileAsText } from "@/lib/file-utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function CanvasToolbar() {
  const { toggleSidebar } = useSidebar();
  const addNode = useCanvasStore((s) => s.addNode);
  const viewport = useCanvasStore((s) => s.viewport);
  const nodes = useCanvasStore((s) => s.nodes);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setFocusNodeId = useCanvasStore((s) => s.setFocusNodeId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showDialog } = useDialog();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  function getNodeSearchText(node: Node): string {
    const d = node.data as Record<string, unknown> | undefined;
    if (!d) return "";
    const parts: string[] = [];
    if (typeof d.text === "string") parts.push(d.text);
    if (typeof d.prompt === "string") parts.push(d.prompt);
    if (typeof d.fileName === "string") parts.push(d.fileName);
    const content = d.content as { markdown?: string } | undefined;
    if (content?.markdown && typeof content.markdown === "string") {
      parts.push(content.markdown.slice(0, 500));
    }
    return parts.join(" ").toLowerCase();
  }

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return nodes.filter((n) => !n.id.startsWith("preview-")).slice(0, 20);
    }
    return nodes
      .filter((n) => {
        if (n.id.startsWith("preview-")) return false;
        return getNodeSearchText(n).includes(q);
      })
      .slice(0, 15);
  }, [nodes, searchQuery]);

  const handleSelectNode = (nodeId: string) => {
    setFocusNodeId(nodeId);
    setSearchOpen(false);
    setSearchQuery("");
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

      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-xl text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all"
                aria-label="Search nodes"
              >
                <Search className="size-4" />
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="bottom" className="text-[10px] py-1 px-2">
            Search nodes
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          className="w-[320px] p-0 rounded-2xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-xl overflow-hidden"
          align="center"
          sideOffset={8}
        >
          <div className="px-3 py-2.5 border-b border-border/40">
            <Input
              placeholder="Buscar por texto, archivo…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 text-[13px] font-normal placeholder:text-muted-foreground/70 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-lg"
              autoFocus
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto overscroll-contain">
            {searchResults.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px] text-muted-foreground/80 tracking-tight">
                  {searchQuery.trim() ? "Ningún nodo coincide" : "Escribe para buscar nodos"}
                </p>
              </div>
            ) : (
              <ul className="py-1.5 px-1">
                {searchResults.map((node) => {
                  const text =
                    (node.data?.text as string) ||
                    (node.data?.fileName as string) ||
                    (node.data?.prompt as string) ||
                    "";
                  const preview = text.slice(0, 72) + (text.length > 72 ? "…" : "");
                  const typeLabel =
                    node.type === "input"
                      ? "Input"
                      : node.type === "response"
                        ? "Response"
                        : node.type === "file"
                          ? "File"
                          : node.type === "display"
                            ? "Display"
                            : node.type;
                  return (
                    <li key={node.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectNode(node.id)}
                        className={cn(
                          "w-full text-left rounded-xl px-3 py-2.5 transition-colors",
                          "hover:bg-accent/80 active:bg-accent",
                          "flex flex-col gap-1"
                        )}
                      >
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                          {typeLabel}
                        </span>
                        <span className="text-[13px] text-foreground/95 leading-snug line-clamp-2">
                          {preview || node.id}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

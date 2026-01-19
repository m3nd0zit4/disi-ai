"use client";

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { ArrowUp, Mic, Plus, Github, Figma, FolderOpen, X } from "lucide-react";
import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAIContext } from "@/context/AIContext";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter, useParams } from "next/navigation";
import ModelSelector from "./chat/ModelSelector";
import ConfigImageSelector from "./chat/ConfigImageSelector";
import { useDialog } from "@/hooks/useDialog";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { FileNodeData } from "./canvas/types";

import { useNodePreview } from "@/hooks/useNodePreview";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";

// Types
export interface FileWithPreview {
  id: string;
  file: File;
  preview?: string;
  type: string;
  uploadStatus: "pending" | "uploading" | "complete" | "error";
  uploadProgress?: number;
  storageId?: string; // S3 Key
  textContent?: string;
}

export interface PastedContent {
  id: string;
  content: string;
  timestamp: Date;
  wordCount: number;
}

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const PASTE_THRESHOLD = 200; // characters threshold for showing as pasted content

import { isTextualFile, readFileAsText } from "@/lib/file-utils";

// Components


interface ChatInputBoxProps {
  canvasId?: Id<"canvas">;
}

export default function ChatInputBox({ canvasId: propCanvasId }: ChatInputBoxProps) {
  const { selectedModels, hasModelsSelected } = useAIContext();
  const router = useRouter();
  const params = useParams();
  
  const canvasId = propCanvasId || (params.canvasId as Id<"canvas">);

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [imageSize, setImageSize] = useState<string>("");
  const [imageQuality, setImageQuality] = useState<string>("");
  const [imageBackground, setImageBackground] = useState<string>("");
  const [imageOutputFormat, setImageOutputFormat] = useState<string>("");
  const [imageN, setImageN] = useState<number>(1);
  const [imageModeration, setImageModeration] = useState<string>("");
  
  // State for files that have been turned into nodes but are waiting to be linked to the next prompt
  const [pendingFiles, setPendingFiles] = useState<{ 
    nodeId: string; 
    fileName: string; 
    preview?: string; 
    fileType?: string;
    isExistingNode?: boolean;
    storageId?: string;
  }[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const { showDialog } = useDialog();

  // Convex mutations and actions
  const createCanvas = useMutation(api.canvas.createCanvas);
  const createFile = useAction(api.files.createFile);

  // Use custom hook for preview logic
  const { handlePromptChange, cleanupPreview, previewNodeIdRef } = useNodePreview(prompt, setPrompt, selectedModels);

  // Track object URLs for revocation
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const uploadControllers = useRef<Map<string, AbortController>>(new Map());

  const revokeUrl = useCallback((url?: string) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(url);
    }
  }, []);

  const createUrl = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.add(url);
    return url;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const nodes = useCanvasStore(state => state.nodes);
  
  // Track previous node state to prevent infinite loops
  const prevNodesRef = useRef<{
    selectedFileNodeIds: Set<string>;
    allNodeIds: Set<string>;
  }>({
    selectedFileNodeIds: new Set(),
    allNodeIds: new Set()
  });

  // Sync pending files with canvas selection
  useEffect(() => {
    const selectedFileNodes = nodes.filter(n => n.selected && n.type === 'file');
    const currentSelectedIds = new Set(selectedFileNodes.map(n => n.id));
    
    // Only update if the selection actually changed
    const prevSelectedIds = prevNodesRef.current.selectedFileNodeIds;
    const hasSelectionChanged = 
      currentSelectedIds.size !== prevSelectedIds.size ||
      [...currentSelectedIds].some(id => !prevSelectedIds.has(id));
    
    if (!hasSelectionChanged) return;
    
    prevNodesRef.current.selectedFileNodeIds = currentSelectedIds;
    
    setPendingFiles(prev => {
      const newPending = [...prev];
      let changed = false;

      selectedFileNodes.forEach(node => {
        if (!newPending.some(p => p.nodeId === node.id)) {
          const fileData = node.data as unknown as FileNodeData;
          newPending.push({
            nodeId: node.id,
            fileName: fileData.fileName || "File",
            preview: fileData.previewUrl || (fileData.fileType?.startsWith("image/") && fileData.storageId ? `/api/file?key=${encodeURIComponent(fileData.storageId)}&redirect=true` : undefined),
            fileType: fileData.fileType,
            isExistingNode: true
          });
          changed = true;
        }
      });

      return changed ? newPending : prev;
    });
  }, [nodes]);

  // Sync pending files with node existence (remove if node is deleted)
  useEffect(() => {
    const currentNodeIds = new Set(nodes.map(n => n.id));
    const prevNodeIds = prevNodesRef.current.allNodeIds;
    
    // Only update if nodes were actually removed
    const hasNodesRemoved = [...prevNodeIds].some(id => !currentNodeIds.has(id));
    
    if (!hasNodesRemoved) {
      prevNodesRef.current.allNodeIds = currentNodeIds;
      return;
    }
    
    prevNodesRef.current.allNodeIds = currentNodeIds;
    
    setPendingFiles(prev => {
      const filtered = prev.filter(p => {
        const exists = currentNodeIds.has(p.nodeId);
        if (!exists) {
          revokeUrl(p.preview);
        }
        return exists;
      });
      return filtered.length !== prev.length ? filtered : prev;
    });
  }, [nodes, revokeUrl]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update defaults when model changes
  useEffect(() => {
    if (hasModelsSelected && selectedModels.length > 0) {
      const currentModel = selectedModels[0];
      const modelInfo = SPECIALIZED_MODELS.find(m => m.id === currentModel.modelId);
      
      if (modelInfo?.category === "image" && modelInfo.providerMetadata?.provider === "GPT") {
        const options = modelInfo.providerMetadata.metadata.imageGenerationOptions;
        if (!options) return;

        if (options.sizes && options.sizes.length > 0) {
          setImageSize(prev => prev || options.sizes?.[0] || "");
        }
        if (options.quality && options.quality.length > 0) {
          setImageQuality(prev => prev || options.quality?.[0] || "");
        }

        if (options.modelType === "gpt-image") {
          if (options.background && options.background.length > 0) {
            setImageBackground(prev => prev || options.background?.[0] || "");
          }
          if (options.output_format && options.output_format.length > 0) {
            setImageOutputFormat(prev => prev || options.output_format?.[0] || "");
          }
          if (options.moderation && options.moderation.length > 0) {
            setImageModeration(prev => prev || options.moderation?.[0] || "");
          }
        }
      }
    }
  }, [selectedModels, hasModelsSelected]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement> | FileList) => {
    const selectedFiles = "target" in e ? (e.target as HTMLInputElement).files : e;
    if (!selectedFiles || !canvasId) return;

    const filesToAdd = Array.from(selectedFiles).slice(0, 10);
    const validFiles = filesToAdd.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        showDialog({ title: "File Too Large", description: `${file.name} exceeds 50MB limit.`, type: "error" });
        return false;
      }
      return true;
    });

    setShowAddMenu(false);

    // Create file nodes on canvas for each file
    for (const file of validFiles) {
      const nodeId = `file-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Read text content if applicable
      let textContent: string | undefined;
      if (isTextualFile(file)) {
        try {
          textContent = await readFileAsText(file);
        } catch {
          textContent = undefined;
        }
      }

      // Add file node to canvas IMMEDIATELY as a REAL node
      const currentNodes = useCanvasStore.getState().nodes;
      
      // Find a good position (e.g. near the last selected node or center)
      const selectedNode = currentNodes.find(n => n.selected);
      const lastNode = currentNodes[currentNodes.length - 1];
      
      const position = selectedNode 
        ? { x: selectedNode.position.x, y: selectedNode.position.y - 200 }
        : lastNode 
          ? { x: lastNode.position.x + 50, y: lastNode.position.y - 150 }
          : { x: 100, y: 100 };

      const previewUrl = file.type.startsWith("image/") ? createUrl(file) : undefined;

      const fileNode = {
        id: nodeId,
        type: "file",
        position,
        selected: true, // Select the new node
        data: {
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          storageId: "", 
          uploadStatus: "uploading" as const,
          textContent,
          previewUrl,
          createdAt: Date.now(),
        },
      };

      // Add to store immediately
      useCanvasStore.getState().addNode(fileNode);

      // Add to pending files list for linking logic (but maybe hide from UI if requested)
      setPendingFiles(prev => [...prev, { 
        nodeId: nodeId, 
        fileName: file.name, 
        preview: previewUrl,
        fileType: file.type,
        isExistingNode: true,
        storageId: "" // Will be updated after upload
      }]);

      // Upload to S3 via Convex action (async)
      const controller = new AbortController();
      uploadControllers.current.set(nodeId, controller);
      (async () => {
        try {
          console.log(`[ChatInputBox] Creating file record in Convex for: ${file.name}`);
          
          // Call Convex action to create file record
          const result = await createFile({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileSize: file.size,
            canvasId: canvasId as Id<"canvas">,
          });

          console.log(`[ChatInputBox] File record created with ID: ${result.fileId}`);
          console.log(`[ChatInputBox] S3 Key: ${result.s3Key}`);
          
          // Generate Presigned URL via local API route
          console.log(`[ChatInputBox] Generating upload URL via local API...`);
          const uploadResponse = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              contentType: file.type, 
              fileName: file.name,
              s3Key: result.s3Key 
            }),
            signal: controller.signal
          });

          if (!uploadResponse.ok) throw new Error("Failed to get upload URL");
          const { url } = await uploadResponse.json();

          console.log(`[ChatInputBox] Uploading to S3...`);
          const uploadResult = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
            signal: controller.signal
          });

          if (!uploadResult.ok) throw new Error("Upload to S3 failed");
          
          if (controller.signal.aborted) return;

          console.log(`[ChatInputBox] ✅ Upload successful! S3 Key: ${result.s3Key}`);
          console.log(`[ChatInputBox] File is now in Convex and Lambda can process it`);

          // Update node with success status and storageId
          useCanvasStore.getState().updateNodeData(nodeId, { 
            storageId: result.s3Key,  // Use the s3Key from Convex
            uploadStatus: "complete" 
          });
          
          // Update pending file reference
          setPendingFiles(prev => prev.map(f => 
            f.nodeId === nodeId ? { ...f, storageId: result.s3Key } : f
          ));

        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
          console.error("[ChatInputBox] ❌ Upload error:", error);
          useCanvasStore.getState().updateNodeData(nodeId, { uploadStatus: "error" });
          showDialog({ title: "Upload Error", description: `Failed to upload ${file.name}`, type: "error" });
        }
      })();
    }
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [canvasId, showDialog, createFile, createUrl]);

  // Removed: removeFile no longer needed - files are nodes now

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const fileItems = Array.from(items).filter(item => item.kind === "file");
    
    // If files are pasted, create file nodes
    if (fileItems.length > 0 && canvasId) {
      e.preventDefault();
      const pastedFiles = fileItems.map(item => item.getAsFile()).filter(Boolean) as File[];
      const dataTransfer = new DataTransfer();
      pastedFiles.forEach(file => dataTransfer.items.add(file));
      handleFileSelect(dataTransfer.files);
      return;
    }

    // Long text paste goes directly into prompt
    const textData = e.clipboardData.getData("text");
    if (textData && textData.length > PASTE_THRESHOLD) {
      e.preventDefault();
      setPrompt(prev => prev + textData);
    }
  }, [canvasId, handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const isSubmittingRef = useRef(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    if (isLoading || isSubmittingRef.current) return;

    setIsLoading(true);
    isSubmittingRef.current = true;
    
    let optimisticInputId: string | undefined = undefined;
    
    try {
      let currentCanvasId = canvasId;

      // Use selected models or default to the first available model if none selected
      const modelsToUse = hasModelsSelected ? selectedModels : [{
        category: "reasoning",
        modelId: "gpt-5.2",
        provider: "GPT",
        providerModelId: "gpt-5.2",
        isEnabled: true,
      }];

      // If there is no canvas, create a new one
      if (!currentCanvasId) {
        currentCanvasId = await createCanvas({
          name: prompt.slice(0, 30) || "New Workflow",
          nodes: [],
          edges: [],
        });
      }

      // Determine parent nodes
      const currentEdges = useCanvasStore.getState().edges;
      const currentNodes = useCanvasStore.getState().nodes;
      
      // Check if we have a selected input node (Free Node or existing Input Node)
      const selectedInputNode = currentNodes.find(n => n.selected && n.type === 'input' && !n.id.startsWith('preview-'));
      
      let parentNodeIds: string[] = [];
      let previewPosition = undefined;

      if (selectedInputNode) {
        // If a node is selected, it is our parent
        parentNodeIds = [selectedInputNode.id];
        previewPosition = selectedInputNode.position;
      } else {
        // Fallback to preview node logic
        const previewEdges = currentEdges.filter(e => e.target === previewNodeIdRef.current);
        parentNodeIds = [...new Set(previewEdges.map(e => e.source))];
        
        if (parentNodeIds.length === 0) {
          const selectedNode = currentNodes.find(n => n.selected && n.id !== previewNodeIdRef.current);
          if (selectedNode) {
              parentNodeIds.push(selectedNode.id);
          }
        }

        const previewNode = currentNodes.find(n => n.id === previewNodeIdRef.current);
        // CRITICAL: Use the preview node's position if it exists (handles manual movement)
        if (previewNode) {
            previewPosition = previewNode.position;
        }
      }

      const previewId = previewNodeIdRef.current;
      // Generate a base ID for the new operation
      const baseId = previewId ? previewId.replace('preview-', '') : `${Date.now()}`;
      const newNodeId = baseId;
      optimisticInputId = `input-${baseId}`;
      
      // Files are now nodes on canvas, no need to pass attachments

      // Determine if this is a branching action (explicit selection)
      const isBranching = !!selectedInputNode;

      // OPTIMISTIC UI: Create the input node immediately if it doesn't exist
      if (!selectedInputNode) {
         const viewport = useCanvasStore.getState().viewport || { x: 0, y: 0, zoom: 1 };
         const inputNodePos = previewPosition || { 
            x: -viewport.x / viewport.zoom + 100, 
            y: -viewport.y / viewport.zoom + 100 
         };
         
         const optimisticInputNode = {
            id: optimisticInputId,
            type: "input",
            position: inputNodePos,
            data: {
               text: prompt,
               createdAt: Date.now(),
            }
         };
         useCanvasStore.getState().addNode(optimisticInputNode);
         
         // Create edges from files to this new input node
         if (optimisticInputId) {
           const targetId = optimisticInputId;
           pendingFiles.forEach(pf => {
              const edgeId = `edge-${pf.nodeId}-${targetId}`;
              useCanvasStore.getState().addEdge({
                 id: edgeId,
                 source: pf.nodeId,
                 target: targetId,
                 animated: true
              });
           });
         }
      }

      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          canvasId: currentCanvasId,
          prompt: prompt,
          models: modelsToUse,
          newNodeId: newNodeId,
          inputNodeId: selectedInputNode?.id, // If we selected an existing node, use it. Otherwise undefined.
          parentNodeIds: parentNodeIds,
          isBranching, // Pass the flag
          fileAttachments: pendingFiles
            .filter(f => f.storageId && f.storageId !== "")
            .map(f => {
              const node = currentNodes.find(n => n.id === f.nodeId);
              return {
                id: f.nodeId, // PASS THE ID!
                storageId: f.storageId,
                name: f.fileName,
                type: f.fileType,
                position: node?.position || { x: 0, y: 0 }
              };
            }),

          position: previewPosition,
          imageSize,
          imageQuality,
          imageBackground,
          imageOutputFormat,
          imageN,
          imageModeration,
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process request");
      }

      cleanupPreview();
      setPrompt("");
      setPendingFiles([]); // Clear pending files after they are linked

      if (!canvasId && currentCanvasId) {
        router.push(`/canvas/${currentCanvasId}`);
      }

    } catch (error) {
      console.error("Error sending message:", error);
      
      // ROLLBACK: Remove optimistic node and edges if API call fails
      if (optimisticInputId) {
        const store = useCanvasStore.getState();
        store.removeNode(optimisticInputId);
        
        pendingFiles.forEach(pf => {
          const edgeId = `edge-${pf.nodeId}-${optimisticInputId}`;
          store.removeEdge(edgeId);
        });
      }

      showDialog({
        title: "Error",
        description: error instanceof Error ? error.message : "The message could not be sent",
        type: "error"
      });
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const selectedModel = hasModelsSelected ? selectedModels[0] : null;
  const modelInfo = selectedModel ? SPECIALIZED_MODELS.find(m => m.id === selectedModel.modelId) : null;
  const isImageModel = modelInfo?.category === "image";
  const imageOptions = modelInfo?.providerMetadata?.provider === "GPT" 
    ? modelInfo.providerMetadata.metadata.imageGenerationOptions 
    : null;

  return (
    <div 
      className="w-full relative z-50"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-background/80 border-2 border-dashed border-primary rounded-xl flex flex-col items-center justify-center pointer-events-none backdrop-blur-sm">
          <p className="text-sm text-primary font-medium flex items-center gap-2">
            <FolderOpen className="size-4" />
            Drop files here to add to chat
          </p>
        </div>
      )}
      <PromptInput
        isLoading={isLoading}
        value={prompt}
        onValueChange={handlePromptChange}
        onSubmit={handleSubmit}
        className="border-primary/5 bg-card/70 backdrop-blur-3xl relative z-10 w-full rounded-2xl border p-0 pt-0.5 shadow-xl"
      >
        <div className="flex flex-col">
          <div className="px-3 pt-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ModelSelector />
              
              {isImageModel && imageOptions && (
                <ConfigImageSelector 
                  imageSize={imageSize}
                  setImageSize={setImageSize}
                  imageQuality={imageQuality}
                  setImageQuality={setImageQuality}
                  imageBackground={imageBackground}
                  setImageBackground={setImageBackground}
                  imageOutputFormat={imageOutputFormat}
                  setImageOutputFormat={setImageOutputFormat}
                  imageN={imageN}
                  setImageN={setImageN}
                  imageModeration={imageModeration}
                  setImageModeration={setImageModeration}
                />
              )}
            </div>
          </div>

          <PromptInputTextarea
            placeholder="Ask anything..."
            onPaste={handlePaste}
            className="min-h-[38px] pt-2 pl-3.5 text-sm leading-relaxed sm:text-sm md:text-sm placeholder:text-muted-foreground/20"
          />

          {/* Preview of files that will be linked to the prompt */}
          {pendingFiles.length > 0 && (
            <div className="px-3 pb-2 flex gap-2 flex-wrap overflow-x-auto hide-scroll-bar">
              {pendingFiles.map((pf) => (
                <div key={pf.nodeId} className="relative group">
                  <div className="h-12 w-12 rounded-lg border border-border bg-muted/50 overflow-hidden flex items-center justify-center relative">
                    {pf.preview ? (
                      <Image 
                        src={pf.preview.startsWith('blob:') || pf.preview.startsWith('http') ? pf.preview : `/api/file?key=${encodeURIComponent(pf.preview)}&redirect=true`} 
                        alt={pf.fileName} 
                        fill
                        className="object-cover" 
                        unoptimized
                      />
                    ) : (
                      <span className="text-[9px] text-muted-foreground uppercase">{pf.fileName.split('.').pop()}</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const fileToRemove = pendingFiles.find(p => p.nodeId === pf.nodeId);
                      if (fileToRemove) {
                        revokeUrl(fileToRemove.preview);
                        
                        // Abort in-progress upload if any
                        const controller = uploadControllers.current.get(pf.nodeId);
                        if (controller) {
                          controller.abort();
                          uploadControllers.current.delete(pf.nodeId);
                        }
                      }
                      setPendingFiles(prev => prev.filter(p => p.nodeId !== pf.nodeId));
                      // Also deselect the node on canvas if it was an existing node
                      if (pf.isExistingNode) {
                        useCanvasStore.getState().setNodes(
                          useCanvasStore.getState().nodes.map(n => 
                            n.id === pf.nodeId ? { ...n, selected: false } : n
                          )
                        );
                      }
                    }}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <PromptInputActions className="mt-1 flex w-full items-center justify-between gap-1.5 px-2.5 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="relative" ref={addMenuRef}>
                <PromptInputAction tooltip="Add Files">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-8 rounded-full transition-all duration-200 hover:bg-primary/5",
                      showAddMenu && "bg-primary text-primary-foreground rotate-45"
                    )}
                    onClick={() => setShowAddMenu(!showAddMenu)}
                  >
                    <Plus size={16} />
                  </Button>
                </PromptInputAction>

                {showAddMenu && (
                  <div className="absolute bottom-10 left-0 z-50 min-w-[180px] overflow-hidden rounded-xl border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95 duration-200 slide-in-from-bottom-2">
                    <div className="grid gap-0.5">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] hover:bg-muted transition-colors text-left"
                      >
                        <FolderOpen size={14} className="text-muted-foreground/60" />
                        <span>Upload Local</span>
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={(e) => handleFileSelect(e)}
                        accept="image/*,.pdf,.txt,.md" // Adjust as needed
                      />
                      <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] hover:bg-muted transition-colors text-left">
                        <Github size={14} className="text-muted-foreground/60" />
                        <span>From GitHub</span>
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] hover:bg-muted transition-colors text-left">
                        <Figma size={14} className="text-muted-foreground/60" />
                        <span>From Figma</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <PromptInputAction tooltip="Voice input">
                <Button variant="ghost" size="icon" className="size-8 rounded-full hover:bg-primary/5">
                  <Mic size={16} />
                </Button>
              </PromptInputAction>

              <Button
                size="icon"
                disabled={!prompt.trim() || isLoading}
                onClick={handleSubmit}
                className="size-8 rounded-full bg-primary shadow-md shadow-primary/10 hover:shadow-primary/20 transition-all"
              >
                {!isLoading ? <ArrowUp size={16} /> : <span className="size-2.5 rounded-xs bg-white animate-pulse" />}
              </Button>
            </div>
          </PromptInputActions>
        </div>
      </PromptInput>
    </div>
  );
}

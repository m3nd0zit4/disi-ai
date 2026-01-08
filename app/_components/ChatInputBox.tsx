"use client";

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { ArrowUp, Mic, Plus, Github, Figma, FolderOpen, Loader2, AlertCircle, X, Copy } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAIContext } from "@/context/AIContext";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter, useParams } from "next/navigation";
import ModelSelector from "./chat/ModelSelector";
import ConfigImageSelector from "./chat/ConfigImageSelector";
import { ToolActionsBar } from "./tools-actions/ToolActionsBar";
import { useDialog } from "@/hooks/useDialog";
import { useCanvasStore } from "@/hooks/useCanvasStore";

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
const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const PASTE_THRESHOLD = 200; // characters threshold for showing as pasted content

// File type helpers
const getFileTypeLabel = (type: string): string => {
  const parts = type.split("/");
  let label = parts[parts.length - 1].toUpperCase();
  if (label.length > 7 && label.includes("-")) {
    label = label.substring(0, label.indexOf("-"));
  }
  if (label.length > 10) {
    label = label.substring(0, 10) + "...";
  }
  return label;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  );
};

const isTextualFile = (file: File): boolean => {
  const textualTypes = [
    "text/",
    "application/json",
    "application/xml",
    "application/javascript",
    "application/typescript",
  ];
  const textualExtensions = [
    "txt", "md", "py", "js", "ts", "jsx", "tsx", "html", "htm", "css", "scss", "sass",
    "json", "xml", "yaml", "yml", "csv", "sql", "sh", "bash", "php", "rb", "go", "java",
    "c", "cpp", "h", "hpp", "cs", "rs", "swift", "kt", "scala", "r", "vue", "svelte",
    "astro", "config", "conf", "ini", "toml", "log", "gitignore", "dockerfile", "makefile", "readme",
  ];
  const isTextualMimeType = textualTypes.some((type) =>
    file.type.toLowerCase().startsWith(type)
  );
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const isTextualExtension =
    textualExtensions.includes(extension) ||
    file.name.toLowerCase().includes("readme") ||
    file.name.toLowerCase().includes("dockerfile") ||
    file.name.toLowerCase().includes("makefile");
  return isTextualMimeType || isTextualExtension;
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || "");
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

const getFileExtension = (filename: string): string => {
  const extension = filename.split(".").pop()?.toUpperCase() || "FILE";
  return extension.length > 8 ? extension.substring(0, 8) + "..." : extension;
};

// Components
const FilePreviewCard: React.FC<{
  file: FileWithPreview;
  onRemove: (id: string) => void;
}> = ({ file, onRemove }) => {
  const isImage = file.type.startsWith("image/");
  const isTextual = isTextualFile(file.file);

  if (isTextual) {
    return <TextualFilePreviewCard file={file} onRemove={onRemove} />;
  }

  return (
    <div
      className={cn(
        "relative group bg-zinc-700 border w-fit border-zinc-600 rounded-lg p-3 size-[100px] shadow-md flex-shrink-0 overflow-hidden",
        isImage ? "p-0" : "p-3"
      )}
    >
      <div className="flex items-start gap-3 size-[100px] overflow-hidden">
        {isImage && file.preview ? (
          <div className="relative size-full rounded-md overflow-hidden bg-zinc-600">
            <img
              src={file.preview || "/placeholder.svg"}
              alt={file.file.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <></>
        )}
        {!isImage && (
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="group absolute flex justify-start items-end p-2 inset-0 bg-gradient-to-b to-[#30302E] from-transparent overflow-hidden">
                <p className="absolute bottom-2 left-2 capitalize text-white text-xs bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-md">
                  {getFileTypeLabel(file.type)}
                </p>
              </div>
              {file.uploadStatus === "uploading" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
              )}
              {file.uploadStatus === "error" && (
                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              )}
            </div>
            <p className="max-w-[90%] text-xs font-medium text-zinc-100 truncate" title={file.file.name}>
              {file.file.name}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              {formatFileSize(file.file.size)}
            </p>
          </div>
        )}
      </div>
      <Button
        size="icon"
        variant="outline"
        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
        onClick={() => onRemove(file.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

const PastedContentCard: React.FC<{
  content: PastedContent;
  onRemove: (id: string) => void;
}> = ({ content, onRemove }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const previewText = content.content.slice(0, 150);
  const needsTruncation = content.content.length > 150;

  return (
    <div className="bg-zinc-700 border border-zinc-600 relative rounded-lg p-3 size-[100px] shadow-md flex-shrink-0 overflow-hidden">
      <div 
        className="text-[8px] text-zinc-300 whitespace-pre-wrap break-words max-h-20 overflow-y-auto custom-scrollbar cursor-pointer hover:text-zinc-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? "Click to collapse" : "Click to expand"}
      >
        {isExpanded || !needsTruncation ? content.content : previewText}
        {!isExpanded && needsTruncation && "..."}
      </div>
      <div className="group absolute flex justify-start items-end p-2 inset-0 bg-gradient-to-b to-[#30302E] from-transparent overflow-hidden pointer-events-none">
        <p className="capitalize text-white text-xs bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-md pointer-events-auto">
          PASTED
        </p>
        <div className="group-hover:opacity-100 opacity-0 transition-opacity duration-300 flex items-center gap-0.5 absolute top-2 right-2 pointer-events-auto">
          <Button
            size="icon"
            variant="outline"
            className="size-6"
            onClick={() => navigator.clipboard.writeText(content.content)}
            title="Copy content"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-6"
            onClick={() => onRemove(content.id)}
            title="Remove content"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const TextualFilePreviewCard: React.FC<{
  file: FileWithPreview;
  onRemove: (id: string) => void;
}> = ({ file, onRemove }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const previewText = file.textContent?.slice(0, 150) || "";
  const needsTruncation = (file.textContent?.length || 0) > 150;
  const fileExtension = getFileExtension(file.file.name);

  return (
    <div className="bg-zinc-700 border border-zinc-600 relative rounded-lg p-3 size-[100px] shadow-md flex-shrink-0 overflow-hidden">
      <div 
        className="text-[8px] text-zinc-300 whitespace-pre-wrap break-words max-h-20 overflow-y-auto custom-scrollbar cursor-pointer hover:text-zinc-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? "Click to collapse" : "Click to expand"}
      >
        {file.textContent ? (
          <>
            {isExpanded || !needsTruncation ? file.textContent : previewText}
            {!isExpanded && needsTruncation && "..."}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>
      <div className="group absolute flex justify-start items-end p-2 inset-0 bg-gradient-to-b to-[#30302E] from-transparent overflow-hidden pointer-events-none">
        <p className="capitalize text-white text-xs bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-md pointer-events-auto">
          {fileExtension}
        </p>
        {file.uploadStatus === "uploading" && (
          <div className="absolute top-2 left-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
          </div>
        )}
        {file.uploadStatus === "error" && (
          <div className="absolute top-2 left-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          </div>
        )}
        <div className="group-hover:opacity-100 opacity-0 transition-opacity duration-300 flex items-center gap-0.5 absolute top-2 right-2 pointer-events-auto">
          {file.textContent && (
            <Button
              size="icon"
              variant="outline"
              className="size-6"
              onClick={() => navigator.clipboard.writeText(file.textContent || "")}
              title="Copy content"
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="icon"
            variant="outline"
            className="size-6"
            onClick={() => onRemove(file.id)}
            title="Remove file"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

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
  
  // New state for files and pasted content
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [pastedContent, setPastedContent] = useState<PastedContent[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const { showDialog } = useDialog();

  // Convex mutations
  const createCanvas = useMutation(api.canvas.createCanvas);

  // Use custom hook for preview logic
  const { handlePromptChange, cleanupPreview, previewNodeIdRef } = useNodePreview(prompt, setPrompt);

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

        if (options.sizes && options.sizes.length > 0 && !imageSize) {
          setImageSize(options.sizes[0]);
        }
        if (options.quality && options.quality.length > 0 && !imageQuality) {
          setImageQuality(options.quality[0]);
        }

        if (options.modelType === "gpt-image") {
          if (options.background && options.background.length > 0 && !imageBackground) {
            setImageBackground(options.background[0]);
          }
          if (options.output_format && options.output_format.length > 0 && !imageOutputFormat) {
            setImageOutputFormat(options.output_format[0]);
          }
          if (options.moderation && options.moderation.length > 0 && !imageModeration) {
            setImageModeration(options.moderation[0]);
          }
        }
      }
    }
  }, [selectedModels, hasModelsSelected, imageSize, imageQuality, imageBackground, imageOutputFormat, imageN, imageModeration]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement> | FileList) => {
    // Use property check to discriminate between ChangeEvent and FileList
    const selectedFiles = "target" in e ? (e.target as HTMLInputElement).files : e;
    if (!selectedFiles) return;

    const currentFileCount = files.length;
    if (currentFileCount >= MAX_FILES) {
      showDialog({ title: "Limit Reached", description: `Maximum ${MAX_FILES} files allowed.`, type: "error" });
      return;
    }

    const availableSlots = MAX_FILES - currentFileCount;
    const filesToAdd = Array.from(selectedFiles).slice(0, availableSlots);
    
    // Filter by size
    const validFiles = filesToAdd.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        showDialog({ title: "File Too Large", description: `${file.name} exceeds 50MB limit.`, type: "error" });
        return false;
      }
      return true;
    });

    const newFiles = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      type: file.type || "application/octet-stream",
      uploadStatus: "pending" as const,
      uploadProgress: 0,
    }));

    setFiles(prev => [...prev, ...newFiles]);
    setShowAddMenu(false);

    // Process uploads
    for (const fileObj of newFiles) {
      // Read text content if applicable
      if (isTextualFile(fileObj.file)) {
        readFileAsText(fileObj.file)
          .then(content => {
            setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, textContent: content } : f));
          })
          .catch(error => {
            console.error(`Failed to read file ${fileObj.file.name}:`, error);
            setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, textContent: "" } : f));
          });
      }

      // Upload to S3
      try {
        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, uploadStatus: "uploading" } : f));
        
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: fileObj.file.type, fileName: fileObj.file.name }),
        });

        if (!response.ok) throw new Error("Failed to get upload URL");
        const { url, key } = await response.json();

        const uploadResult = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": fileObj.file.type },
          body: fileObj.file,
        });

        if (!uploadResult.ok) throw new Error("Upload to S3 failed");

        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, uploadStatus: "complete", storageId: key } : f));
      } catch (error) {
        console.error("Upload error:", error);
        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, uploadStatus: "error" } : f));
        showDialog({ title: "Upload Error", description: `Failed to upload ${fileObj.file.name}`, type: "error" });
      }
    }
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [files.length, showDialog]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const fileItems = Array.from(items).filter(item => item.kind === "file");
    
    if (fileItems.length > 0 && files.length < MAX_FILES) {
      e.preventDefault();
      const pastedFiles = fileItems.map(item => item.getAsFile()).filter(Boolean) as File[];
      const dataTransfer = new DataTransfer();
      pastedFiles.forEach(file => dataTransfer.items.add(file));
      handleFileSelect(dataTransfer.files);
      return;
    }

    const textData = e.clipboardData.getData("text");
    if (textData && textData.length > PASTE_THRESHOLD && pastedContent.length < 5) {
      e.preventDefault();
      // Append a snippet to prompt
      setPrompt(prev => prev + textData.slice(0, PASTE_THRESHOLD) + "...");
      
      const pastedItem: PastedContent = {
        id: Math.random().toString(36).substring(7),
        content: textData,
        timestamp: new Date(),
        wordCount: textData.split(/\s+/).filter(Boolean).length,
      };
      setPastedContent(prev => [...prev, pastedItem]);
    }
  }, [files.length, pastedContent.length, handleFileSelect]);

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
    if (!prompt.trim() && files.length === 0 && pastedContent.length === 0) return;
    if (isLoading || isSubmittingRef.current) return;
    if (files.some(f => f.uploadStatus === "uploading" || f.uploadStatus === "error")) {
      const hasErrors = files.some(f => f.uploadStatus === "error");
      showDialog({ 
        title: hasErrors ? "Upload Failed" : "Wait", 
        description: hasErrors ? "Some files failed to upload. Please remove them and try again." : "Please wait for files to finish uploading.", 
        type: hasErrors ? "error" : "info" 
      });
      return;
    }

    setIsLoading(true);
    isSubmittingRef.current = true;
    
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
        previewPosition = previewNode?.position;
      }

      const previewId = previewNodeIdRef.current;
      const newNodeId = previewId ? previewId.replace('preview-', '') : `node-${Date.now()}`;
      
      // Combine prompt with pasted content
      let finalPrompt = prompt;
      if (pastedContent.length > 0) {
        finalPrompt += "\n\n--- Pasted Content ---\n";
        pastedContent.forEach(pc => {
          finalPrompt += `\n${pc.content}\n`;
        });
      }

      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          canvasId: currentCanvasId,
          prompt: finalPrompt,
          models: modelsToUse,
          newNodeId: newNodeId,
          inputNodeId: selectedInputNode?.id, // Pass existing node ID to reuse
          parentNodeIds: parentNodeIds, // Pass array of parent IDs
          position: previewPosition,
          imageSize,
          imageQuality,
          imageBackground,
          imageOutputFormat,
          imageN,
          imageModeration,
          attachments: files
            .filter(f => f.uploadStatus === "complete" && f.storageId)
            .map(f => ({ 
              storageId: f.storageId as string, 
              type: f.type.startsWith("image/") ? "image" : "file", 
              name: f.file.name, 
              size: f.file.size 
            })),
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process request");
      }

      cleanupPreview();
      setPrompt("");
      setFiles([]);
      setPastedContent([]);

      if (!canvasId && currentCanvasId) {
        router.push(`/canvas/${currentCanvasId}`);
      }

    } catch (error) {
      console.error("Error sending message:", error);
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
            <ToolActionsBar />
          </div>

          <PromptInputTextarea
            placeholder="Ask anything..."
            onPaste={handlePaste}
            className="min-h-[38px] pt-2 pl-3.5 text-sm leading-relaxed sm:text-sm md:text-sm placeholder:text-muted-foreground/20"
          />

          {(files.length > 0 || pastedContent.length > 0) && (
            <div className="px-3 pb-2 flex gap-2 flex-wrap overflow-x-auto hide-scroll-bar">
               {pastedContent.map((content) => (
                <PastedContentCard
                  key={content.id}
                  content={content}
                  onRemove={(id) => setPastedContent(prev => prev.filter(c => c.id !== id))}
                />
              ))}
              {files.map((file) => (
                <FilePreviewCard
                  key={file.id}
                  file={file}
                  onRemove={removeFile}
                />
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

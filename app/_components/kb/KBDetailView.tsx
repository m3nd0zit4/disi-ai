"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  FileUp, 
  Globe, 
  Search, 
  Loader2, 
  Maximize2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SeedCard } from "@/components/knowledge-garden/SeedCard";
import { SeedDetailView } from "@/components/knowledge-garden/SeedDetailView";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { Id } from "@/convex/_generated/dataModel";

interface KBDetailViewProps {
  kbId: string;
  selectedFileId: string | null;
  onFileSelect: (fileId: string | null, fileName?: string | null) => void;
}

export function KBDetailView({ kbId, selectedFileId, onFileSelect }: KBDetailViewProps) {
  const [search, setSearch] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const { toast } = useToast();

  const seeds = useQuery(api.knowledge_garden.seeds.listByKb, { kbId: kbId as Id<"knowledgeBases"> });
  const files = useQuery(api.system.files.getFiles, { kbId: kbId as Id<"knowledgeBases"> });
  const availableTags = useQuery(api.knowledge_garden.seeds.listTags, { kbId: kbId as Id<"knowledgeBases"> });
  const kb = useQuery(api.knowledge_garden.knowledgeBases.get, { id: kbId as Id<"knowledgeBases"> });
  const updateKb = useMutation(api.knowledge_garden.knowledgeBases.update);
  const generateUploadUrl = useAction(api.system.files.generateUploadUrl);
  const extractUrlContent = useAction(api.knowledge_garden.actions.extractUrlContent);
  const confirmUpload = useAction(api.system.files.confirmUpload);

  const standaloneSeeds = useMemo(() => {
    if (!seeds) return [];
    return seeds.filter(s => !s.fileId && s.title.toLowerCase().includes(search.toLowerCase()));
  }, [seeds, search]);

  const filteredFiles = useMemo(() => {
    if (!files) return [];
    return files.filter(f => f.fileName.toLowerCase().includes(search.toLowerCase()));
  }, [files, search]);

  const selectedFileSeeds = useMemo(() => {
    if (!seeds || !selectedFileId) return [];
    return seeds.filter(s => s.fileId === selectedFileId);
  }, [seeds, selectedFileId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    console.log("[KBDetailView] Starting file upload:", file.name, "size:", file.size, "type:", file.type);

    let fileId: string | null = null;

    try {
      // Step 1: Generate upload URL
      console.log("[KBDetailView] Step 1: Generating upload URL...");
      const result = await generateUploadUrl({
        kbId: kbId as Id<"knowledgeBases">,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
      fileId = result.fileId;
      console.log("[KBDetailView] Step 1 complete - fileId:", fileId, "uploadUrl length:", result.uploadUrl?.length);

      // Step 2: Upload to S3
      console.log("[KBDetailView] Step 2: Uploading to S3...");
      let s3Response: Response;
      try {
        s3Response = await fetch(result.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
      } catch (fetchError) {
        console.error("[KBDetailView] S3 fetch error (CORS/network):", fetchError);
        throw new Error(`S3 network error: ${fetchError instanceof Error ? fetchError.message : "Unknown fetch error"}`);
      }

      if (!s3Response.ok) {
        const errorText = await s3Response.text().catch(() => "");
        console.error("[KBDetailView] S3 error response:", s3Response.status, errorText);
        throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`);
      }
      console.log("[KBDetailView] Step 2 complete - S3 upload successful, status:", s3Response.status);

      // Step 3: Confirm upload to trigger worker processing
      console.log("[KBDetailView] Step 3: Calling confirmUpload for fileId:", fileId);
      try {
        await confirmUpload({ fileId: fileId as Id<"files"> });
        console.log("[KBDetailView] Step 3 complete - confirmUpload successful!");
      } catch (confirmError) {
        console.error("[KBDetailView] confirmUpload error:", confirmError);
        throw new Error(`Confirm upload failed: ${confirmError instanceof Error ? confirmError.message : "Unknown error"}`);
      }

      toast({
        title: "Upload Started",
        description: "Your file is being processed by the worker.",
      });
    } catch (error) {
      console.error("[KBDetailView] Upload failed at some step:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "There was an error uploading your file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleUrlSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && urlInput) {
      setIsExtracting(true);
      try {
        await extractUrlContent({
          url: urlInput,
          kbId: kbId as Id<"knowledgeBases">,
        });
        toast({
          title: "URL Extracted",
          description: "Content has been added to the knowledge base.",
        });
        setUrlInput("");
      } catch (error) {
        console.error("Extraction failed:", error);
        toast({
          title: "Extraction Failed",
          description: "Could not extract content from the URL.",
          variant: "destructive",
        });
      } finally {
        setIsExtracting(false);
      }
    }
  };

  const submitText = async () => {
    if (!textInput.trim()) return;
    
    setIsUploading(true);
    try {
      const blob = new Blob([textInput], { type: "text/plain" });
      const fileName = `note-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
      const file = new File([blob], fileName, { type: "text/plain" });

      const { uploadUrl, fileId } = await generateUploadUrl({
        kbId: kbId as Id<"knowledgeBases">,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      await confirmUpload({ fileId });

      toast({
        title: "Note Saved",
        description: "Your text has been saved and is being processed.",
      });
      setTextInput("");
    } catch (error) {
      console.error("Text upload failed:", error);
      toast({
        title: "Save Failed",
        description: "Could not save your note.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      submitText();
    }
  };

  const selectedFile = useMemo(() => {
    if (!files || !selectedFileId) return null;
    return files.find(f => f._id === selectedFileId);
  }, [files, selectedFileId]);

  // If a file is selected, show detail view instead of grid
  if (selectedFile) {
    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
        <SeedDetailView
          file={{
            _id: selectedFile._id,
            fileName: selectedFile.fileName,
            fileType: selectedFile.fileType,
            status: selectedFile.status,
            createdAt: selectedFile.createdAt,
            totalChunks: selectedFile.totalChunks,
            s3Key: selectedFile.s3Key,
          }}
          seeds={selectedFileSeeds}
          kbId={kbId}
          onClose={() => onFileSelect(null)}
          onPromote={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Input Section */}
      <div className="space-y-4">
        <div className="flex gap-4 h-[200px]">
          {/* Text Input Area */}
          <div className="flex-1 relative group rounded-2xl bg-muted/20 border border-border/50 overflow-hidden transition-all focus-within:ring-1 focus-within:ring-primary/20">
            <textarea 
              placeholder="Paste text directly..." 
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleTextSubmit}
              disabled={isUploading}
              className="w-full h-full p-6 bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground/40"
            />
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-3.5 h-3.5 text-muted-foreground/60 cursor-pointer hover:text-foreground" />
            </div>
            <div className="absolute bottom-4 right-4">
              <div 
                onClick={submitText}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/50 border border-border/50 text-[10px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                {isUploading ? "Saving..." : <>Add <span className="opacity-50">Ctrl + ↵</span></>}
              </div>
            </div>
          </div>

          {/* Upload Cards */}
          <div className="flex gap-4 w-[500px]">
            <div 
              onClick={() => document.getElementById("kb-file-upload")?.click()}
              className="flex-1 relative group cursor-pointer rounded-2xl bg-muted/20 border border-border/50 hover:bg-muted/30 hover:border-primary/20 transition-all flex flex-col items-center justify-center text-center space-y-3 overflow-hidden"
            >
              <input type="file" id="kb-file-upload" className="hidden" onChange={handleUpload} disabled={isUploading} />
              <div className="size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileUp className="w-5 h-5" />}
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold">From File</h3>
                <p className="text-[10px] text-muted-foreground/50">Extract content from files</p>
              </div>
              <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                {['pdf', 'md', 'txt', 'doc'].map(t => (
                  <span key={t} className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground">{t}</span>
                ))}
              </div>
            </div>

            <div className="flex-1 relative group rounded-2xl bg-muted/20 border border-border/50 flex flex-col items-center justify-center text-center space-y-3 hover:bg-muted/30 hover:border-primary/20 transition-all">
              <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold">From Web Link</h3>
                <p className="text-[10px] text-muted-foreground/50">Extract content from web links</p>
              </div>
              <div className="w-full px-4">
                <Input 
                  placeholder="Enter URLs" 
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={handleUrlSubmit}
                  disabled={isExtracting}
                  className="h-7 text-[10px] bg-background/50 border-none text-center placeholder:text-muted-foreground/30 focus-visible:ring-1 focus-visible:ring-primary/20" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <Switch 
              id="smart-split" 
              checked={kb?.smartSplitEnabled ?? true}
              onCheckedChange={(checked) => updateKb({ id: kbId as Id<"knowledgeBases">, smartSplitEnabled: checked })}
            />
            <label htmlFor="smart-split" className="text-[11px] font-medium text-muted-foreground">
              Current Mode: <span className={cn("font-bold transition-colors", (kb?.smartSplitEnabled ?? true) ? "text-indigo-400" : "text-emerald-400")}>
                {(kb?.smartSplitEnabled ?? true) ? "AI Smart Split" : "Quick Split"}
              </span>
            </label>
          </div>
          <p className="text-[10px] text-muted-foreground/40 max-w-xl text-right leading-tight">
            {(kb?.smartSplitEnabled ?? true) 
              ? "AI intelligently analyzes content and optimizes splitting logic, can filter redundant information while maintaining semantic integrity, but processing time is longer"
              : "Splits directly by sentences, completely preserves the original text, processes quickly but performs no optimization"
            }
          </p>
        </div>
      </div>

      {/* Search & Tags */}
      <div className="space-y-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
          <input 
            placeholder="Input keywords, file types to search..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-12 pr-4 rounded-2xl bg-primary/5 border border-primary/5 focus:bg-primary/10 focus:border-primary/20 outline-none text-sm transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {availableTags?.map(tag => (
            <Badge 
              key={tag} 
              variant="outline" 
              className="bg-primary/5 border-none text-[10px] font-bold px-3 py-1 hover:bg-primary/10 cursor-pointer transition-colors"
              onClick={() => setSearch(tag)}
            >
              #{tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-4 pb-8">
        {filteredFiles.length > 0 || standaloneSeeds.length > 0 ? (
          <>
            {filteredFiles.map((file) => (
              <SeedCard
                key={file._id}
                id={file._id}
                title={file.fileName}
                status={file.status as "uploading" | "uploaded" | "processing" | "ready" | "error"}
                createdAt={file.createdAt}
                seedCount={file.totalChunks}
                s3Key={file.s3Key}
                fileType={file.fileType}
                onOpen={(id) => {
                  const selectedFile = files?.find(f => f._id === id);
                  onFileSelect(id, selectedFile?.fileName);
                }}
                onPromote={() => {}}
              />
            ))}
            {standaloneSeeds.map((seed) => (
              <SeedCard
                key={seed._id}
                id={seed._id}
                title={seed.title}
                status="ready"
                createdAt={seed._creationTime}
                seedCount={1}
                onOpen={() => {}} // Standalone seeds might not open a detail view yet
                onPromote={() => {}}
              />
            ))}
          </>
        ) : (
          <div className="col-span-4 flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50">
            <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Globe className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold">Knowledge Garden Empty</h3>
              <p className="text-xs text-muted-foreground">Start by adding content above</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

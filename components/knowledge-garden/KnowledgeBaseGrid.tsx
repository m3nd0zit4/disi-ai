"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SeedCard } from "./SeedCard";
import { BlankState } from "./BlankState";
import { SidePanel } from "./SidePanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeBaseGridProps {
  kbId: string;
}

export function KnowledgeBaseGrid({ kbId }: KnowledgeBaseGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  // Queries
  const seeds = useQuery(api.knowledge_garden.seeds.listByKb, { kbId: kbId as any });
  const selectedSeed = useQuery(api.knowledge_garden.seeds.getDetail, selectedSeedId ? { seedId: selectedSeedId as any } : "skip");
  
  // Actions/Mutations
  const generateUploadUrl = useAction(api.system.files.generateUploadUrl);
  const updateStatus = useAction(api.system.files.publicUpdateStatusByS3Key); // Using public action for now, but should be internal or via worker

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Get Presigned URL
      const { uploadUrl, s3Key, fileId } = await generateUploadUrl({
        kbId: kbId as any,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      // 2. Upload to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // 3. Trigger Processing (Ideally this is automatic via S3 event -> SQS -> Worker)
      // For now, we rely on the worker polling or we can manually trigger if needed.
      // But since we have a worker polling, we just need to make sure the file status is 'uploading' (set by create)
      // and then the worker picks it up. 
      // Actually, we might want to update status to 'uploaded' so worker knows it's ready to process?
      // The current worker logic polls for 'uploading' status? Let's check worker.
      // Worker polls `publicGetPendingFiles` which returns 'uploading'.
      // So we don't need to do anything else.

      toast({
        title: "Upload Started",
        description: "Your file is being processed. It will appear here shortly.",
      });

    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const filteredSeeds = seeds?.filter(seed => 
    seed.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (seeds === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (seeds.length === 0 && !searchQuery) {
    return (
      <>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleUpload}
          disabled={isUploading}
        />
        <BlankState onUpload={() => document.getElementById("file-upload")?.click()} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search seeds..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="file"
            id="file-upload-toolbar"
            className="hidden"
            onChange={handleUpload}
            disabled={isUploading}
          />
          <Button onClick={() => document.getElementById("file-upload-toolbar")?.click()} disabled={isUploading}>
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Add Content
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredSeeds?.map((seed) => (
          <SeedCard
            key={seed._id}
            id={seed._id}
            title={seed.title}
            summary={seed.summary}
            status={seed.status as any}
            createdAt={seed.createdAt}
            tags={seed.tags}
            onOpen={setSelectedSeedId}
            onPromote={(id) => console.log("Promote", id)}
          />
        ))}
      </div>

      {/* Side Panel */}
      <SidePanel
        isOpen={!!selectedSeedId}
        onClose={() => setSelectedSeedId(null)}
        seed={selectedSeed}
        onPromote={(id) => console.log("Promote", id)}
      />
    </div>
  );
}

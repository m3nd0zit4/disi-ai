"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, ZoomIn, ZoomOut, Loader2, FileText, ExternalLink } from "lucide-react";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { useToast } from "@/hooks/use-toast";

interface SeedDetailViewProps {
  file: {
    _id: string;
    fileName: string;
    fileType: string;
    status: string;
    createdAt: number;
    totalChunks?: number;
    s3Key: string;
  };
  seeds: Array<{
    _id: string;
    _creationTime: number;
    title: string;
    summary?: string;
    fullText?: string;
    tags?: string[];
  }> | undefined;
  kbId: string;
  onClose: () => void;
  onPromote?: (id: string) => void;
}

export function SeedDetailView({ file, seeds, kbId }: SeedDetailViewProps) {
  const { toast } = useToast();
  const [selectedSeed, setSelectedSeed] = useState<NonNullable<typeof seeds>[number] | null>(null);
  const [isViewFullOpen, setIsViewFullOpen] = useState(false);
  const [isAddSeedOpen, setIsAddSeedOpen] = useState(false);
  const [newSeedText, setNewSeedText] = useState("");
  const [isCreatingSeed, setIsCreatingSeed] = useState(false);
  const [zoom, setZoom] = useState(100);

  // Get signed URL for the file
  const fileUrl = useSignedUrl(file?.s3Key);

  // Mutation for creating new seeds
  const createSeed = useMutation(api.knowledge_garden.seeds.create);

  if (!file) return null;

  const handleViewFull = (seed: NonNullable<typeof seeds>[number]) => {
    setSelectedSeed(seed);
    setIsViewFullOpen(true);
  };

  const handleAddSeed = async () => {
    if (!newSeedText.trim()) return;

    setIsCreatingSeed(true);
    try {
      await createSeed({
        kbId: kbId as Id<"knowledgeBases">,
        fileId: file._id as Id<"files">,
        title: `${file.fileName} - Manual Seed`,
        fullText: newSeedText,
        summary: newSeedText.substring(0, 100) + (newSeedText.length > 100 ? "..." : ""),
        status: "ready",
        tags: ["manual"],
      });

      toast({
        title: "Seed Created",
        description: "Your new seed has been added successfully.",
      });

      setNewSeedText("");
      setIsAddSeedOpen(false);
    } catch (error) {
      console.error("Failed to create seed:", error);
      toast({
        title: "Error",
        description: "Failed to create seed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingSeed(false);
    }
  };

  const isPdf = file.fileType === "application/pdf" || file.fileName.toLowerCase().endsWith(".pdf");
  const isImage = file.fileType?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.fileName);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <div className="p-6 h-full flex flex-col">
          <div className="space-y-1 mb-6">
            <h2 className="text-lg font-bold text-foreground">{file.fileName}</h2>
            <p className="text-xs text-muted-foreground">AI-powered knowledge seeds extracted from your knowledge</p>
          </div>

          <Tabs defaultValue="seeds" className="flex-1 flex flex-col">
            <TabsList className="bg-transparent border-b border-border w-full justify-start h-auto p-0 rounded-none space-x-6">
              <TabsTrigger
                value="seeds"
                className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 py-2 text-xs font-bold text-muted-foreground data-[state=active]:text-primary transition-all"
              >
                Seeds
              </TabsTrigger>
              <TabsTrigger
                value="source"
                className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 py-2 text-xs font-bold text-muted-foreground data-[state=active]:text-primary transition-all"
              >
                Original Source
              </TabsTrigger>
            </TabsList>

            <div className="mt-6 flex-1 overflow-hidden">
              {/* Seeds Tab */}
              <TabsContent value="seeds" className="h-full m-0">
                <ScrollArea className="h-full pr-4">
                  <div className="grid grid-cols-1 gap-4 pb-4">
                    {/* Add New Seed Card */}
                    <div
                      onClick={() => setIsAddSeedOpen(true)}
                      className="h-[200px] rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/30 hover:border-border/50 transition-all cursor-pointer group"
                    >
                      <div className="p-3 rounded-full bg-muted group-hover:bg-muted/80 transition-colors">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium">Add New Seed</span>
                    </div>

                    {/* Seed Cards */}
                    {seeds?.map((seed, index) => (
                      <div
                        key={seed._id}
                        className="bg-muted/30 border border-border rounded-xl overflow-hidden group hover:border-border/50 transition-all"
                      >
                        <div className="p-5 space-y-4">
                          {/* Seed Header */}
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                                {new Date(seed._creationTime).toLocaleString()}
                              </div>
                              <h3 className="text-sm font-bold text-foreground leading-tight">
                                {seed.title}
                              </h3>
                            </div>
                          </div>

                          {/* Seed Content Preview */}
                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                              Summary
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                              {seed.summary || seed.fullText?.substring(0, 150) + "..."}
                            </p>
                          </div>

                          {/* Metadata / Tags */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            {seed.tags?.map((tag: string) => (
                              <div
                                key={tag}
                                className="px-2 py-1 rounded bg-muted text-[10px] font-medium text-muted-foreground"
                              >
                                {tag}
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-auto h-6 text-[10px] bg-transparent border-border hover:bg-muted"
                              onClick={() => handleViewFull(seed)}
                            >
                              View Full
                            </Button>
                          </div>
                        </div>

                        {/* Seed Footer */}
                        <div className="bg-muted/50 px-5 py-2 border-t border-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">
                              SEED-{index + 1}
                            </span>
                            <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[200px]">
                              {seed.title}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Original Source Tab */}
              <TabsContent value="source" className="h-full m-0">
                <div className="h-full flex flex-col">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setZoom(Math.max(25, zoom - 25))}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-medium text-muted-foreground min-w-[60px] text-center">
                        {zoom}%
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setZoom(Math.min(200, zoom + 25))}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                    {fileUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => window.open(fileUrl, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open in New Tab
                      </Button>
                    )}
                  </div>

                  {/* File Preview */}
                  <div className="flex-1 rounded-xl border border-border bg-muted/20 overflow-hidden">
                    {!fileUrl ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-xs">Loading file preview...</span>
                      </div>
                    ) : isPdf ? (
                      <iframe
                        src={`${fileUrl}#view=FitH`}
                        className="w-full h-full"
                        style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left", width: `${10000/zoom}%`, height: `${10000/zoom}%` }}
                        title={file.fileName}
                      />
                    ) : isImage ? (
                      <div className="h-full flex items-center justify-center p-4 overflow-auto">
                        <img
                          src={fileUrl}
                          alt={file.fileName}
                          className="max-w-full max-h-full object-contain transition-transform"
                          style={{ transform: `scale(${zoom / 100})` }}
                        />
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                        <FileText className="w-10 h-10" />
                        <span className="text-xs">Preview not available for this file type</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => window.open(fileUrl, "_blank")}
                        >
                          Download File
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* View Full Modal */}
      <Dialog open={isViewFullOpen} onOpenChange={setIsViewFullOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">{selectedSeed?.title}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Full content of this seed
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[60vh]">
            <div className="pr-4">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {selectedSeed?.fullText || selectedSeed?.summary || "No content available"}
              </p>
            </div>
          </ScrollArea>
          <DialogFooter className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedSeed?.fullText?.length || 0} characters
            </span>
            <Button variant="outline" size="sm" onClick={() => setIsViewFullOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Seed Modal */}
      <Dialog open={isAddSeedOpen} onOpenChange={setIsAddSeedOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Add New Seed</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manually add a knowledge seed to this file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              value={newSeedText}
              onChange={(e) => setNewSeedText(e.target.value)}
              placeholder="Enter the content for your new seed..."
              className="w-full h-48 p-4 text-sm rounded-lg border border-border bg-muted/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
              disabled={isCreatingSeed}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {newSeedText.length}/2000
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddSeedOpen(false)}
                  disabled={isCreatingSeed}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddSeed}
                  disabled={!newSeedText.trim() || isCreatingSeed}
                >
                  {isCreatingSeed ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Seed"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

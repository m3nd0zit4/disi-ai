"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Book, 
  X,
  Share2,
  Globe,
  MoreHorizontal,
  Info,
  Search,
  Pencil,
  Copy,
  Trash,
  ChevronRight,
  ArrowLeft
} from "lucide-react";
import { 
  Dialog, 
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useKnowledgeCommand } from "@/hooks/useKnowledgeCommand";
import { KBWelcomeState } from "./KBWelcomeState";
import { KBDetailView } from "./KBDetailView";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Doc } from "@/convex/_generated/dataModel";

export function KnowledgeCommand() {
  const { isOpen, close, selectedKbId, setSelectedKbId } = useKnowledgeCommand();
  const kbs = useQuery(api.knowledge_garden.knowledgeBases.list);
  const createKb = useMutation(api.knowledge_garden.knowledgeBases.create);
  const updateKb = useMutation(api.knowledge_garden.knowledgeBases.update);
  const deleteKb = useAction(api.knowledge_garden.knowledgeBases.deleteKb);

  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [renamingKbId, setRenamingKbId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);



  const filteredKbs = useMemo(() => {
    if (!kbs) return [];
    return kbs.filter((kb: Doc<"knowledgeBases">) => 
      kb.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [kbs, search]);

  const selectedKb = useMemo(() => {
    return kbs?.find((kb: Doc<"knowledgeBases">) => kb._id === selectedKbId);
  }, [kbs, selectedKbId]);

  const handleCreate = async () => {
    if (!newKbName) return;
    setIsCreating(true);
    try {
      const kbId = await createKb({
        name: newKbName,
        description: "Your personal knowledge base for better AI generation",
      });
      setNewKbName("");
      setShowCreateForm(false);
      setSelectedKbId(kbId);
    } catch (error) {
      console.error("Failed to create KB:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!renameName) return;
    try {
      await updateKb({ id: id as any, name: renameName });
      setRenamingKbId(null);
    } catch (error) {
      console.error("Failed to rename:", error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteKb({ id: id as any });
        if (selectedKbId === id) setSelectedKbId(null);
      } catch (error) {
        console.error("Failed to delete:", error);
      }
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    // toast("Copied ID to clipboard"); // Assuming toast is available or just silent
  };

  // ... handleCreate

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] p-0 overflow-hidden bg-background/95 backdrop-blur-3xl border-border shadow-2xl rounded-[32px]">
        <DialogTitle className="sr-only">Knowledge Base</DialogTitle>
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-[280px] border-r border-border flex flex-col bg-muted/20">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold tracking-tight">Knowledge Bases</h2>
                  <div className="size-4 rounded-full bg-muted flex items-center justify-center cursor-help">
                    <Info className="w-2.5 h-2.5 text-muted-foreground" />
                  </div>
                </div>
                <button 
                  onClick={() => setShowCreateForm(true)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <input 
                  placeholder="Search collections..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8 pl-9 pr-3 rounded-lg bg-muted/50 border border-transparent focus:bg-background focus:border-border outline-none text-[11px] transition-all"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 px-3">
              <div className="space-y-1">
                {showCreateForm && (
                  <div className="px-3 py-2 space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <input
                      autoFocus
                      placeholder="KB Name..."
                      value={newKbName}
                      onChange={(e) => setNewKbName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                      className="w-full h-9 px-3 rounded-lg bg-background border border-input text-xs outline-none focus:border-primary/30 transition-all"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setShowCreateForm(false)} className="text-[10px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                      <button 
                        onClick={handleCreate} 
                        disabled={isCreating || !newKbName}
                        className="text-[10px] font-bold text-primary hover:underline disabled:opacity-50"
                      >
                        {isCreating ? "Creating..." : "Create"}
                      </button>
                    </div>
                  </div>
                )}

                {filteredKbs.map((kb: Doc<"knowledgeBases">) => (
                  <div key={kb._id} className="relative group">
                    {renamingKbId === kb._id ? (
                      <div className="px-3 py-2">
                        <input
                          autoFocus
                          value={renameName}
                          onChange={(e) => setRenameName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(kb._id);
                            if (e.key === 'Escape') setRenamingKbId(null);
                          }}
                          onBlur={() => setRenamingKbId(null)}
                          className="w-full h-8 px-2 rounded bg-background border border-primary/50 text-xs outline-none"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedKbId(kb._id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative pr-8",
                          selectedKbId === kb._id 
                            ? "bg-primary/10 text-primary border border-primary/10" 
                            : "hover:bg-muted text-muted-foreground hover:text-foreground border border-transparent"
                        )}
                      >
                        <Book className={cn("w-4 h-4", selectedKbId === kb._id ? "text-primary" : "text-muted-foreground/40 group-hover:text-primary/60")} />
                        <span className="text-xs font-semibold truncate">{kb.name}</span>
                        {selectedKbId === kb._id && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-full" />
                        )}
                      </button>
                    )}

                    {!renamingKbId && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded-md hover:bg-background/50 text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuItem onClick={() => {
                              setRenamingKbId(kb._id);
                              setRenameName(kb.name);
                            }}>
                              <Pencil className="w-3.5 h-3.5 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyId(kb._id)}>
                              <Copy className="w-3.5 h-3.5 mr-2" />
                              Copy ID
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(kb._id, kb.name)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash className="w-3.5 h-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                ))}

                {filteredKbs.length === 0 && !showCreateForm && (
                  <div className="px-3 py-8 text-center space-y-2">
                    <p className="text-[11px] text-muted-foreground/30 italic">No projects for now</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-background/50">
            {/* Header */}
            <div className="h-[80px] border-b border-border flex items-center justify-between px-8">
              <div className="flex items-center gap-3">
                {selectedFileId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-muted"
                    onClick={() => {
                      setSelectedFileId(null);
                      setSelectedFileName(null);
                    }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                <div className="space-y-1">
                  {selectedFileId && selectedFileName ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-sm font-bold text-foreground">{selectedKb?.name || "Knowledge Base"}</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className="text-sm font-bold text-foreground">{selectedFileName}</span>
                    </div>
                  ) : (
                    <h1 className="text-lg font-bold tracking-tight">
                      {selectedKb ? selectedKb.name : "Knowledge Base"}
                    </h1>
                  )}
                  {!selectedFileId && (
                    <p className="text-[11px] text-muted-foreground/60">
                      {selectedKb ? selectedKb.description : "Your personal knowledge base for better AI generation"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-1">
              <div className="p-8 h-full">
                {selectedKbId ? (
                  <KBDetailView 
                    kbId={selectedKbId} 
                    selectedFileId={selectedFileId}
                    onFileSelect={(fileId, fileName) => {
                      setSelectedFileId(fileId);
                      setSelectedFileName(fileName || null);
                    }}
                  />
                ) : (
                  <KBWelcomeState />
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

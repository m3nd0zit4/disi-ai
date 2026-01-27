import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, X, Plus } from "lucide-react";
import { useState } from "react";

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  file: any;
  seeds: any[] | undefined;
  onPromote: (id: string) => void;
}

export function SidePanel({ isOpen, onClose, file, seeds, onPromote }: SidePanelProps) {
  if (!file) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:w-[800px] flex flex-col h-full p-0 bg-[#0A0A0A] border-l border-white/5">
        {/* Header */}
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Knowledge Base</span>
            <ChevronRight className="w-3 h-3" />
            <span className="font-bold text-foreground">{file.fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 pb-0">
            <div className="space-y-1 mb-6">
              <h2 className="text-lg font-bold text-white">{file.fileName}</h2>
              <p className="text-xs text-muted-foreground">AI-powered knowledge seeds extracted from your knowledge</p>
            </div>

            <Tabs defaultValue="seeds" className="w-full">
              <TabsList className="bg-transparent border-b border-white/5 w-full justify-start h-auto p-0 rounded-none space-x-6">
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

              <div className="mt-6 h-[calc(100vh-220px)]">
                <TabsContent value="seeds" className="h-full m-0">
                  <ScrollArea className="h-full pr-4">
                    <div className="grid grid-cols-1 gap-4 pb-10">
                      {/* Add New Seed Placeholder */}
                      <div className="h-[200px] rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-white/[0.02] hover:border-white/20 transition-all cursor-pointer group">
                        <div className="p-3 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                          <Plus className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-medium">Add New Seed</span>
                      </div>

                      {seeds?.map((seed, index) => (
                        <div key={seed._id} className="bg-[#121212] border border-white/5 rounded-xl overflow-hidden group hover:border-white/10 transition-all">
                          <div className="p-5 space-y-4">
                            {/* Seed Header */}
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                                  {new Date(seed.createdAt).toLocaleString()}
                                </div>
                                <h3 className="text-sm font-bold text-white/90 leading-tight">
                                  {seed.title}
                                </h3>
                              </div>
                            </div>

                            {/* Seed Content Preview */}
                            <div className="space-y-2">
                              <div className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">
                                Summary
                              </div>
                              <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-3">
                                {seed.summary || seed.fullText?.substring(0, 150)}
                              </p>
                            </div>

                            {/* Metadata / Tags */}
                            <div className="flex flex-wrap gap-2 pt-2">
                              <div className="px-2 py-1 rounded bg-white/5 text-[10px] font-medium text-muted-foreground">
                                FACTURA No
                              </div>
                              <div className="px-2 py-1 rounded bg-white/5 text-[10px] font-medium text-muted-foreground">
                                VALOR TRANSACCIÓN
                              </div>
                              <Button variant="outline" size="sm" className="ml-auto h-6 text-[10px] bg-transparent border-white/10 hover:bg-white/5">
                                View Full
                              </Button>
                            </div>
                          </div>

                          {/* Seed Footer */}
                          <div className="bg-white/[0.02] px-5 py-2 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-wider">SEED-{index + 1}</span>
                              <span className="text-[10px] font-medium text-muted-foreground/60 truncate max-w-[200px]">{seed.title}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="source" className="h-full m-0">
                  <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                    Original source content not available for preview.
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

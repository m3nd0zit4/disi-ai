"use client"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/sidebar"
import Image from "next/image"
import {
  Moon,
  Sun,
  Plus,
  Leaf,
  Trash2,
  MessageSquarePlus,
  Sparkles,
  MoreVertical,
  Pin,
  ChevronDown,
  Check,
  Copy,
  Pencil
} from "lucide-react"
import { useTheme } from "next-themes"
import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Doc, Id } from "@/convex/_generated/dataModel"
import { useRouter } from "next/navigation"
import { useDialog } from "@/hooks/useDialog"
import { useKnowledgeCommand } from "@/hooks/useKnowledgeCommand"
import { useCanvasStore } from "@/hooks/useCanvasStore"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { GardenStatsPanel } from "./GardenStatsPanel"
import { cn } from "@/lib/utils"
import { useState } from "react"

// Canvas List Item Component
interface CanvasListItemProps {
    canvas: Doc<"canvas">;
    isPinned: boolean;
    onPin: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
    onDuplicate: (e: React.MouseEvent) => void;
    onRename: (e: React.MouseEvent) => void;
}

function CanvasListItem({ canvas, isPinned, onPin, onDelete, onDuplicate, onRename }: CanvasListItemProps) {
    return (
        <div className="group flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-all">
            <Link
                href={`/canvas/${canvas._id}`}
                className="flex items-center gap-2 min-w-0 flex-1"
            >
                <Sparkles className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                <span className="text-[12px] truncate group-hover:text-foreground transition-colors">
                    {canvas.name}
                </span>
            </Link>
            <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-all">
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-4 rounded-sm shrink-0 focus:outline-none focus-visible:ring-0 hover:bg-transparent"
                    onClick={onPin}
                >
                    <Pin className={cn("w-2 h-2", isPinned ? "text-primary" : "text-muted-foreground/50")} />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-4 rounded-sm shrink-0 focus:outline-none focus-visible:ring-0 hover:bg-transparent"
                            onClick={(e) => e.preventDefault()}
                        >
                            <MoreVertical className="w-2.5 h-2.5 text-muted-foreground/50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 p-1">
                        <DropdownMenuItem onClick={onDuplicate} className="text-[11px] py-1.5 px-2 cursor-pointer">
                            <Copy className="w-3 h-3 mr-2" />
                            Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onRename} className="text-[11px] py-1.5 px-2 cursor-pointer">
                            <Pencil className="w-3 h-3 mr-2" />
                            Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1" />
                        <DropdownMenuItem
                            onClick={onDelete}
                            variant="destructive"
                            className="text-[11px] py-1.5 px-2 cursor-pointer"
                        >
                            <Trash2 className="w-3 h-3 mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

export function AppSidebar() {
    const { theme, setTheme } = useTheme();
    const canvases = useQuery(api.canvas.canvas.listCanvas);
    const deleteCanvas = useMutation(api.canvas.canvas.deleteCanvas);
    const togglePinCanvas = useMutation(api.canvas.canvas.togglePinCanvas);
    const router = useRouter();
    const { showDialog } = useDialog();
    const openKnowledgeCommand = useKnowledgeCommand((state) => state.open);

    // Collapsible states
    const [isPinnedOpen, setIsPinnedOpen] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);

    // Separate pinned and unpinned canvases
    const pinnedCanvases = canvases?.filter(c => c.isPinned) ?? [];
    const unpinnedCanvases = canvases?.filter(c => !c.isPinned) ?? [];
    
    // Knowledge Garden State (from Convex)
    const gardenSettings = useQuery(api.users.settings.getGardenSettings);
    const updateGardenSettings = useMutation(api.users.settings.updateGardenSettings);
    const gardenStats = useCanvasStore((state) => state.gardenStats);

    const isGardenActive = gardenSettings?.isActive ?? false;
    const feedMode = gardenSettings?.feedMode ?? "manual";

    const handleGardenToggle = async (active: boolean) => {
        try {
            await updateGardenSettings({ isActive: active });
        } catch (error) {
            console.error("Failed to update garden settings:", error);
        }
    };

    const handleFeedModeChange = async (mode: "manual" | "assisted" | "automatic") => {
        try {
            await updateGardenSettings({ feedMode: mode });
        } catch (error) {
            console.error("Failed to update feed mode:", error);
        }
    };

    const handleNewFlow = () => {
        router.push("/");
    };

    const handlePin = async (e: React.MouseEvent, canvasId: Id<"canvas">) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await togglePinCanvas({ canvasId });
        } catch (error) {
            console.error("Error toggling pin:", error);
        }
    };

    const handleDelete = async (e: React.MouseEvent, canvasId: Id<"canvas">) => {
        e.preventDefault();
        e.stopPropagation();

        showDialog({
            title: "Delete Workflow",
            description: "Are you sure you want to delete this workflow? This action cannot be undone.",
            type: "confirm",
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    await deleteCanvas({ canvasId });
                    if (window.location.pathname.includes(canvasId)) {
                        router.push("/");
                    }
                } catch (error) {
                    console.error("Error deleting workflow:", error);
                    showDialog({
                        title: "Error",
                        description: "Could not delete the workflow. Please try again.",
                        type: "error"
                    });
                }
            }
        });
    };

    const handleDuplicate = async (e: React.MouseEvent, canvasId: Id<"canvas">) => {
        e.preventDefault();
        e.stopPropagation();
        // TODO: Implement duplicate functionality
        console.log("Duplicate canvas:", canvasId);
    };

    const handleRename = async (e: React.MouseEvent, canvasId: Id<"canvas">) => {
        e.preventDefault();
        e.stopPropagation();
        // TODO: Implement rename functionality with input dialog
        console.log("Rename canvas:", canvasId);
    };

    return (
        <Sidebar className="border-r border-primary/5 bg-card/30 backdrop-blur-xl">
            <SidebarHeader className="p-3">
                <div className="flex justify-between items-center mb-4">
                    <Link href="/canvas" className="flex items-center gap-2 group">
                        <h1 className="logo-font text-lg tracking-tight mt-2">Disi</h1>
                    </Link>
                    <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/5" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                        {theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </Button>
                </div>

                <div className="space-y-1">
                    <Button 
                        onClick={handleNewFlow}
                        className="w-full justify-between h-9 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/5 transition-all group"
                    >
                        <span className="text-[13px] font-bold tracking-tight">New Flow</span>
                        <MessageSquarePlus className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </Button>
                    
                    <Button 
                        variant="ghost" 
                        onClick={() => openKnowledgeCommand()}
                        className="w-full justify-between h-9 px-3 rounded-lg hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all group"
                    >
                        <span className="text-[13px] font-bold tracking-tight">Knowledge Garden</span>
                        <Leaf className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </Button>
                </div>

                {/* Knowledge Garden Agent Section */}
                <div className="mt-6 space-y-3">
                    <div className="px-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={cn("size-2 rounded-full transition-colors", isGardenActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-muted-foreground/30")} />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Feed the Garden</span>
                        </div>
                        <Switch
                            checked={isGardenActive}
                            onCheckedChange={handleGardenToggle}
                            className="scale-75 data-[state=checked]:bg-emerald-500"
                        />
                    </div>

                    {/* Feed Mode Selector */}
                    {isGardenActive && (
                        <div className="px-3">
                            <Select value={feedMode} onValueChange={handleFeedModeChange}>
                                <SelectTrigger className="h-7 text-[10px] bg-muted/30 border-none">
                                    <SelectValue placeholder="Select mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="assisted" className="text-[11px]">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-amber-500" />
                                            Assisted
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="automatic" className="text-[11px]">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-emerald-500" />
                                            Automatic
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[9px] text-muted-foreground/50 mt-1.5 leading-tight px-0.5">
                                {feedMode === "manual" && "Click 'Add to KG' on responses to save"}
                                {feedMode === "assisted" && "AI suggests valuable content to save"}
                                {feedMode === "automatic" && "AI automatically saves high-quality content"}
                            </p>
                        </div>
                    )}

                    <div className="px-1">
                        <GardenStatsPanel
                            isActive={isGardenActive}
                            stats={gardenStats}
                        />
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className="px-1.5">
                <SidebarGroup>
                    <SidebarGroupLabel className="px-3 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/40 mb-1 flex items-center justify-between">
                        Projects
                        <Plus className="w-2.5 h-2.5 cursor-pointer hover:text-primary transition-colors" />
                    </SidebarGroupLabel>
                    <div className="space-y-0.5">
                        <div className="px-3 py-1.5 text-[10px] text-muted-foreground/40 italic">No projects yet</div>
                    </div>
                </SidebarGroup>

                {/* Pinned Section */}
                {pinnedCanvases.length > 0 && (
                    <SidebarGroup>
                        <Collapsible open={isPinnedOpen} onOpenChange={setIsPinnedOpen}>
                            <CollapsibleTrigger asChild>
                                <SidebarGroupLabel className="px-3 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/40 mb-1 flex items-center justify-between cursor-pointer hover:text-muted-foreground transition-colors">
                                    <div className="flex items-center gap-1.5">
                                        Pinned
                                        <ChevronDown className={cn("w-2.5 h-2.5 transition-transform", isPinnedOpen ? "" : "-rotate-90")} />
                                    </div>
                                    <Check className="w-2.5 h-2.5 opacity-40" />
                                </SidebarGroupLabel>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="space-y-0.5">
                                    {pinnedCanvases.map((canvas: Doc<"canvas">) => (
                                        <CanvasListItem
                                            key={canvas._id}
                                            canvas={canvas}
                                            isPinned={true}
                                            onPin={(e) => handlePin(e, canvas._id)}
                                            onDelete={(e) => handleDelete(e, canvas._id)}
                                            onDuplicate={(e) => handleDuplicate(e, canvas._id)}
                                            onRename={(e) => handleRename(e, canvas._id)}
                                        />
                                    ))}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </SidebarGroup>
                )}

                {/* History Section */}
                <SidebarGroup>
                    <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                        <CollapsibleTrigger asChild>
                            <SidebarGroupLabel className="px-3 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/40 mb-1 flex items-center justify-between cursor-pointer hover:text-muted-foreground transition-colors">
                                <div className="flex items-center gap-1.5">
                                    History
                                    <ChevronDown className={cn("w-2.5 h-2.5 transition-transform", isHistoryOpen ? "" : "-rotate-90")} />
                                </div>
                                <Check className="w-2.5 h-2.5 opacity-40" />
                            </SidebarGroupLabel>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="space-y-0.5">
                                {unpinnedCanvases.length === 0 ? (
                                    <div className="px-3 py-1.5 text-[10px] text-muted-foreground/40 italic">No history yet</div>
                                ) : (
                                    unpinnedCanvases.map((canvas: Doc<"canvas">) => (
                                        <CanvasListItem
                                            key={canvas._id}
                                            canvas={canvas}
                                            isPinned={false}
                                            onPin={(e) => handlePin(e, canvas._id)}
                                            onDelete={(e) => handleDelete(e, canvas._id)}
                                            onDuplicate={(e) => handleDuplicate(e, canvas._id)}
                                            onRename={(e) => handleRename(e, canvas._id)}
                                        />
                                    ))
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </SidebarGroup>
            </SidebarContent>
        <SidebarFooter>
            <div className="p-3 flex gap-2">
                <UserButton
                    showName
                    appearance={
                        {
                            elements: {
                                rootBox: "w-full! h-8! box-border!",
                                userButtonTrigger: "w-full! p-2! hover:bg-sidebar! hover:text-sidebar-foreground! group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:size-2! box-border!",
                                userButtonBox: "w-full! flex-row-reverse! justify-end! gap-2! group-data-[collapsible=icon]:justify-center! text-sidebar-foreground!",
                                userButtonQuterIdentifier: "pl-0 group-data-[collapsible=icon]:hidden!",
                                avatarBox: "size-7!"
                            }
                        }
                    }
                />
            </div>
        </SidebarFooter>
        </Sidebar>
    )
}
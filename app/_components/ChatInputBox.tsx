"use client";

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { ArrowUp, Mic, Plus, Github, Figma, FolderOpen } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAIContext } from "@/context/AIContext";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter, useParams } from "next/navigation";
import ModelSelector from "./chat/ModelSelector";
import { ToolActionsBar } from "./tools-actions/ToolActionsBar";
import { useDialog } from "@/hooks/useDialog";
import { useCanvasStore } from "@/hooks/useCanvasStore";

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

  const addMenuRef = useRef<HTMLDivElement>(null);
  const { showDialog } = useDialog();

  // Convex mutations
  const createCanvas = useMutation(api.canvas.createCanvas);

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

  // Get nodes to determine parent
  // Get nodes and actions from store
  const nodes = useCanvasStore(state => state.nodes);
  const addNode = useCanvasStore(state => state.addNode);
  const updateNodeData = useCanvasStore(state => state.updateNodeData);
  const removeNode = useCanvasStore(state => state.removeNode);
  const addEdge = useCanvasStore(state => state.addEdge);
  const removeEdge = useCanvasStore(state => state.removeEdge);
  const previewNodeIdRef = useRef<string | null>(null);
  const previewEdgeIdRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);
  const isSubmittingRef = useRef(false);

  const handlePromptChange = (newPrompt: string) => {
    setPrompt(newPrompt);

    if (!newPrompt.trim()) {
      if (previewNodeIdRef.current) {
        removeNode(previewNodeIdRef.current);
        previewNodeIdRef.current = null;
      }
      if (previewEdgeIdRef.current) {
        removeEdge(previewEdgeIdRef.current);
        previewEdgeIdRef.current = null;
      }
      return;
    }

    // Check if we are editing an existing node
    const selectedInputNode = nodes.find(n => n.selected && n.type === 'input' && !n.id.startsWith('preview-'));
    if (selectedInputNode) return;

    // Creation logic ONLY if it doesn't exist
    if (!previewNodeIdRef.current) {
      const newNodeId = `preview-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      previewNodeIdRef.current = newNodeId;

      const selectedNode = nodes.find(n => n.selected && !n.id.startsWith('preview-'));
      const position = selectedNode 
        ? { x: selectedNode.position.x, y: selectedNode.position.y + 400 } 
        : nodes.length > 0
          ? { x: nodes[nodes.length - 1].position.x, y: nodes[nodes.length - 1].position.y + 200 }
          : { x: 100, y: 100 };

      addNode({
        id: newNodeId,
        type: "input",
        position,
        data: { 
          text: newPrompt,
          createdAt: new Date().toISOString()
        }
      });

      if (selectedNode) {
        const newEdgeId = `edge-preview-${Date.now()}`;
        previewEdgeIdRef.current = newEdgeId;
        addEdge({
          id: newEdgeId,
          source: selectedNode.id,
          target: newNodeId,
          animated: true,
        });
      }
    }
  };

  // Targeted selector for the selected input node
  const selectedInputNode = useCanvasStore(state => 
    state.nodes.find(n => n.selected && n.type === 'input' && !n.id.startsWith('preview-'))
  );

  // Selection to Prompt Sync
  useEffect(() => {
    if (selectedInputNode) {
      isSyncingRef.current = true;
      setPrompt((selectedInputNode.data.text as string) || "");
      
      // Clear any preview if we just selected an existing node
      if (previewNodeIdRef.current) {
        removeNode(previewNodeIdRef.current);
        previewNodeIdRef.current = null;
      }
      if (previewEdgeIdRef.current) {
        removeEdge(previewEdgeIdRef.current);
        previewEdgeIdRef.current = null;
      }
      
      const timer = setTimeout(() => { isSyncingRef.current = false; }, 0);
      return () => clearTimeout(timer);
    } else if (!previewNodeIdRef.current && prompt !== "") {
      // Clear prompt immediately when selection is lost and no preview is active
      setPrompt("");
    }
  }, [selectedInputNode?.id, removeNode, removeEdge]);

  // Real-time update ONLY effect
  useEffect(() => {
    if (isSyncingRef.current || !prompt.trim()) return;

    const currentNodes = useCanvasStore.getState().nodes;
    const selectedInputNode = currentNodes.find(n => n.selected && n.type === 'input' && !n.id.startsWith('preview-'));

    // If editing an existing node
    if (selectedInputNode) {
      if (prompt !== selectedInputNode.data.text) {
        updateNodeData(selectedInputNode.id, { text: prompt });
      }
      return;
    }

    // Update existing preview node
    if (previewNodeIdRef.current) {
      updateNodeData(previewNodeIdRef.current, { text: prompt });
      
      const selectedNode = currentNodes.find(n => n.selected && !n.id.startsWith('preview-'));
      const previewNode = currentNodes.find(n => n.id === previewNodeIdRef.current);

      if (previewNode && selectedNode) {
        const currentEdges = useCanvasStore.getState().edges;
        const existingEdge = currentEdges.find(e => e.target === previewNodeIdRef.current);
        
        if (!existingEdge || existingEdge.source !== selectedNode.id) {
          if (previewEdgeIdRef.current) {
            removeEdge(previewEdgeIdRef.current);
          }
          const newEdgeId = `edge-preview-${Date.now()}`;
          previewEdgeIdRef.current = newEdgeId;
          addEdge({
            id: newEdgeId,
            source: selectedNode.id,
            target: previewNodeIdRef.current,
            animated: true,
          });
        }
      } else if (previewNode && !selectedNode && previewEdgeIdRef.current) {
        removeEdge(previewEdgeIdRef.current);
        previewEdgeIdRef.current = null;
      }
    }
  }, [prompt, updateNodeData, addEdge, removeEdge]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading || isSubmittingRef.current) return;

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
        
        console.log("Canvas creado: ", currentCanvasId);
      }

      // Determine parent node (selected node or last node)
      const currentNodes = useCanvasStore.getState().nodes;
      const selectedNode = currentNodes.find(n => n.selected && n.id !== previewNodeIdRef.current);
      const parentNodeId = selectedNode ? selectedNode.id : undefined;

      // Create a new node ID for this message
      // Use the preview ID if it exists to maintain continuity, but strip the prefix
      const previewId = previewNodeIdRef.current;
      const newNodeId = previewId ? previewId.replace('preview-', '') : `node-${Date.now()}`;
      
      // Trigger AI execution via API
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
          parentNodeId: parentNodeId, // Pass parent node ID
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process request");
      }

      // Clean input
      // Important: Explicitly remove the preview node from the store
      if (previewNodeIdRef.current) {
        removeNode(previewNodeIdRef.current);
        previewNodeIdRef.current = null;
      }
      
      // Clear local state
      setPrompt("");

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

  return (
    <div className="w-full relative z-50">
      <PromptInput
        isLoading={isLoading}
        value={prompt}
        onValueChange={handlePromptChange}
        onSubmit={handleSubmit}
        className="border-primary/5 bg-card/70 backdrop-blur-3xl relative z-10 w-full rounded-2xl border p-0 pt-0.5 shadow-xl"
      >
        <div className="flex flex-col">
          <div className="px-3 pt-1.5 flex items-center justify-between">
            <ModelSelector />
            <ToolActionsBar />
          </div>

          <PromptInputTextarea
            placeholder="Ask anything..."
            className="min-h-[38px] pt-2 pl-3.5 text-sm leading-relaxed sm:text-sm md:text-sm placeholder:text-muted-foreground/20"
          />

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
                      <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] hover:bg-muted transition-colors text-left">
                        <FolderOpen size={14} className="text-muted-foreground/60" />
                        <span>Upload Local</span>
                      </button>
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

"use client";

import { createContext, useContext, useCallback, useRef, useEffect, ReactNode } from "react";
import { 
  Connection, 
  EdgeChange, 
  NodeChange, 
  OnConnectStartParams
} from "@xyflow/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { handleWorkflowConnection } from "../actions/workflow-connections";

interface ConnectionsContextType {
  onConnect: (connection: Connection) => void;
  onConnectStart: (event: MouseEvent | TouchEvent, params: OnConnectStartParams) => void;
  onConnectEnd: () => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeDragStart: (event: any, node: any) => void;
  onNodeDragStop: (event: any, node: any) => void;
  handleQuickAction: () => void;
  deleteNode: (nodeId: string) => void;
  updateNode: (nodeId: string, data: Record<string, any>) => void;
  regenerateNode: (nodeId: string) => Promise<void>;
}

const ConnectionsContext = createContext<ConnectionsContextType | null>(null);

export const useConnections = () => {
  const context = useContext(ConnectionsContext);
  if (!context) throw new Error("useConnections must be used within ConnectionsProvider");
  return context;
};

interface ConnectionsProviderProps {
  children: ReactNode;
  canvasId: Id<"canvas">;
}

export const ConnectionsProvider = ({ children, canvasId }: ConnectionsProviderProps) => {
  const { 
    setEdges,
    onNodesChange: storeOnNodesChange, 
    onEdgesChange: storeOnEdgesChange 
  } = useCanvasStore();
  
  const updateCanvas = useMutation(api.canvas.updateCanvas);
  const createCanvasExecution = useMutation(api.canvasExecutions.createCanvasExecution);
  
  const connectingNodeId = useRef<string | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, []);

  // Debounced update
  const debouncedUpdateCanvas = useCallback((data: any) => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      updateCanvas(data);
    }, 500);
  }, [updateCanvas]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    storeOnNodesChange(changes);
    
    // Only sync to DB if there are "real" changes (position, data, etc.)
    // We ignore 'select' changes to avoid unnecessary DB writes and auth errors on selection
    const hasRealChanges = changes.some(c => c.type !== 'select');
    if (!hasRealChanges) return;

    const latestNodes = useCanvasStore.getState().nodes;
    // Filter out preview nodes before syncing to DB
    const nodesToSync = latestNodes.filter(n => !n.id.startsWith('preview-'));
    
    debouncedUpdateCanvas({ canvasId, nodes: nodesToSync });
  }, [canvasId, debouncedUpdateCanvas, storeOnNodesChange]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    storeOnEdgesChange(changes);
    const latestEdges = useCanvasStore.getState().edges;
    // Filter out preview edges before syncing to DB
    const edgesToSync = latestEdges.filter(e => !e.id.startsWith('edge-preview-') && !e.target.startsWith('preview-'));
    
    debouncedUpdateCanvas({ canvasId, edges: edgesToSync });
  }, [canvasId, debouncedUpdateCanvas, storeOnEdgesChange]);

  const handleConnect = useCallback((connection: Connection) => {
    const latestEdges = useCanvasStore.getState().edges;
    const newEdges = handleWorkflowConnection(connection, latestEdges);
    setEdges(newEdges);
    debouncedUpdateCanvas({ canvasId, edges: newEdges });
  }, [canvasId, debouncedUpdateCanvas, setEdges]);

  const onConnectStart = useCallback((_: MouseEvent | TouchEvent, { nodeId }: OnConnectStartParams) => {
    connectingNodeId.current = nodeId;
  }, []);

  const onConnectEnd = useCallback(
    () => {
      // Menu logic removed as per refactor plan
      connectingNodeId.current = null;
    },
    []
  );

  const handleQuickAction = useCallback(() => {
    // Quick action logic removed
    console.warn("Quick action is deprecated");
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    useCanvasStore.getState().removeNode(nodeId);
    const latestNodes = useCanvasStore.getState().nodes;
    // Filter out preview nodes before syncing to DB
    const nodesToSync = latestNodes.filter(n => !n.id.startsWith('preview-'));
    debouncedUpdateCanvas({ canvasId, nodes: nodesToSync });
  }, [canvasId, debouncedUpdateCanvas]);

  const updateNode = useCallback((nodeId: string, data: Record<string, any>) => {
    useCanvasStore.getState().updateNodeData(nodeId, data);
    const latestNodes = useCanvasStore.getState().nodes;
    // Filter out preview nodes before syncing to DB
    const nodesToSync = latestNodes.filter(n => !n.id.startsWith('preview-'));
    debouncedUpdateCanvas({ canvasId, nodes: nodesToSync });
  }, [canvasId, debouncedUpdateCanvas]);

  const regenerateNode = useCallback(async (nodeId: string) => {
    const { nodes, edges } = useCanvasStore.getState();
    
    // 1. Find parent node to get context
    const incomingEdge = edges.find(e => e.target === nodeId);
    let prompt = "";
    
    if (incomingEdge) {
      const parentNode = nodes.find(n => n.id === incomingEdge.source);
      if (parentNode) {
        prompt = (parentNode.data?.text as string) || (parentNode.data?.userInput as string) || "";
      }
    }

    // Fallback: If no parent prompt, try using the node's own data
    if (!prompt) {
      const targetNode = nodes.find(n => n.id === nodeId);
      if (targetNode) {
        prompt = (targetNode.data?.text as string) || (targetNode.data?.userInput as string) || "";
      }
    }

    // Validation: If prompt is still empty, abort
    if (!prompt) {
      console.warn(`Regeneration aborted for node ${nodeId}: No prompt could be derived from parent or self.`);
      useCanvasStore.getState().updateNodeData(nodeId, { 
        status: "error", 
        error: "No input found to regenerate response" 
      });
      return;
    }

    // 2. Update local state
    useCanvasStore.getState().updateNodeData(nodeId, { 
      text: "", 
      status: "thinking", 
      error: undefined, 
      reasoning: undefined,
      prompt // Pass parent text as prompt
    });
    
    // 3. Sync to DB immediately (skip debounce)
    // We sync EDGES too to ensure the backend graph traversal works if needed
    const latestNodes = useCanvasStore.getState().nodes;
    const latestEdges = useCanvasStore.getState().edges;
    
    const nodesToSync = latestNodes.filter(n => !n.id.startsWith('preview-'));
    const edgesToSync = latestEdges.filter(e => !e.id.startsWith('edge-preview-') && !e.target.startsWith('preview-'));

    await updateCanvas({ 
      canvasId, 
      nodes: nodesToSync,
      edges: edgesToSync 
    });

    // 4. Create execution & Trigger worker
    try {
      const executionId = await createCanvasExecution({ canvasId });
      
      await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId,
          executionId,
          prompt, // Pass prompt directly to avoid DB race conditions
          targetNodeId: nodeId // Explicitly target this node
        }),
      }).then(res => {
        if (!res.ok) {
          throw new Error(`Execution request failed: ${res.status}`);
        }
        return res;
      });
    } catch (error) {
      console.error("Failed to trigger regeneration:", error);
      useCanvasStore.getState().updateNodeData(nodeId, { 
        status: "error", 
        error: "Failed to start generation" 
      });
    }
  }, [canvasId, updateCanvas, createCanvasExecution]);

  const onNodeDragStart = useCallback((_: any, node: any) => {
    useCanvasStore.getState().setDraggedNodeId(node.id);
  }, []);

  const onNodeDragStop = useCallback(() => {
    useCanvasStore.getState().setDraggedNodeId(null);
  }, []);

  return (
    <ConnectionsContext.Provider value={{
      onConnect: handleConnect,
      onConnectStart,
      onConnectEnd,
      onNodesChange: handleNodesChange,
      onEdgesChange: handleEdgesChange,
      onNodeDragStart,
      onNodeDragStop,
      handleQuickAction,
      deleteNode,
      updateNode,
      regenerateNode
    }}>
      {children}
    </ConnectionsContext.Provider>
  );
};

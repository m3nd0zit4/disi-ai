"use client";

import { createContext, useContext, useCallback, useRef, useState, ReactNode } from "react";
import { 
  Connection, 
  EdgeChange, 
  NodeChange, 
  applyNodeChanges, 
  applyEdgeChanges,
  OnConnectStartParams,
  Edge,
  Node
} from "@xyflow/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { handleWorkflowConnection } from "../actions/workflow-connections";

interface ConnectionsContextType {
  onConnect: (connection: Connection) => void;
  onConnectStart: (event: MouseEvent | TouchEvent, params: OnConnectStartParams) => void;
  onConnectEnd: (event: MouseEvent | TouchEvent) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  handleQuickAction: () => void;
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
    nodes, 
    edges, 
    setEdges,
    onNodesChange: storeOnNodesChange, 
    onEdgesChange: storeOnEdgesChange 
  } = useCanvasStore();
  
  const updateCanvas = useMutation(api.canvas.updateCanvas);
  
  const connectingNodeId = useRef<string | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    const updatedNodes = applyNodeChanges(changes, nodes);
    debouncedUpdateCanvas({ canvasId, nodes: updatedNodes });
  }, [canvasId, debouncedUpdateCanvas, nodes, storeOnNodesChange]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    storeOnEdgesChange(changes);
    const updatedEdges = applyEdgeChanges(changes, edges);
    debouncedUpdateCanvas({ canvasId, edges: updatedEdges });
  }, [canvasId, debouncedUpdateCanvas, edges, storeOnEdgesChange]);

  const handleConnect = useCallback((connection: Connection) => {
    const newEdges = handleWorkflowConnection(connection, edges);
    setEdges(newEdges);
    debouncedUpdateCanvas({ canvasId, edges: newEdges });
  }, [canvasId, debouncedUpdateCanvas, edges, setEdges]);

  const onConnectStart = useCallback((_: MouseEvent | TouchEvent, { nodeId }: OnConnectStartParams) => {
    connectingNodeId.current = nodeId;
  }, []);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      // Menu logic removed as per refactor plan
      connectingNodeId.current = null;
    },
    []
  );

  const handleQuickAction = useCallback(() => {
    // Quick action logic removed
    console.warn("Quick action is deprecated");
  }, []);

  return (
    <ConnectionsContext.Provider value={{
      onConnect: handleConnect,
      onConnectStart,
      onConnectEnd,
      onNodesChange: handleNodesChange,
      onEdgesChange: handleEdgesChange,
      handleQuickAction
    }}>
      {children}
    </ConnectionsContext.Provider>
  );
};

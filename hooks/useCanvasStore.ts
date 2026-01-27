import { create } from "zustand";
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  Viewport,
} from "@xyflow/react";

export interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Record<string, any>) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (edgeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  draggedNodeId: string | null;
  setDraggedNodeId: (id: string | null) => void;
  selectedNodeIdForToolbar: string | null;
  setSelectedNodeIdForToolbar: (id: string | null) => void;
  viewport: Viewport | null;
  setViewport: (canvasId: string, viewport: Viewport) => void;
  loadViewport: (canvasId: string) => void;
  isKnowledgePanelOpen: boolean;
  setKnowledgePanelOpen: (isOpen: boolean) => void;
  // Knowledge Garden State
  isGardenActive: boolean;
  setGardenActive: (active: boolean) => void;
  gardenStats: {
    files: number;
    seeds: number;
    tokens: number;
  };
  updateGardenStats: (stats: Partial<{ files: number; seeds: number; tokens: number }>) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  draggedNodeId: null as string | null,
  setDraggedNodeId: (id: string | null) => set({ draggedNodeId: id }),
  selectedNodeIdForToolbar: null as string | null,
  setSelectedNodeIdForToolbar: (id: string | null) => set({ selectedNodeIdForToolbar: id }),
  viewport: { x: 0, y: 0, zoom: 1 },
  isKnowledgePanelOpen: false,
  setKnowledgePanelOpen: (isOpen: boolean) => set({ isKnowledgePanelOpen: isOpen }),

  // Knowledge Garden Initial State
  isGardenActive: false,
  setGardenActive: (active) => set({ isGardenActive: active }),
  gardenStats: { files: 0, seeds: 0, tokens: 0 },
  updateGardenStats: (stats) => set((state) => ({
    gardenStats: { ...state.gardenStats, ...stats }
  })),

  setViewport: (canvasId: string, viewport: Viewport) => {
    set({ viewport });
    try {
      localStorage.setItem(`canvas-viewport-${canvasId}`, JSON.stringify(viewport));
    } catch (e) {
      console.error("Failed to save viewport to localStorage", e);
    }
  },
  loadViewport: (canvasId: string) => {
    try {
      const saved = localStorage.getItem(`canvas-viewport-${canvasId}`);
      if (saved) {
        set({ viewport: JSON.parse(saved) });
      }
    } catch (e) {
      console.error("Failed to load viewport from localStorage", e);
    }
  },
  onNodesChange: (changes: NodeChange[]) => {
    const { nodes, edges, draggedNodeId } = get();
    
    // Determine the primary node being dragged
    let primaryDraggedId = draggedNodeId;
    
    // Fallback: try to find it in changes if not explicitly set
    if (!primaryDraggedId) {
      const dragChange = changes.find(c => c.type === 'position' && c.dragging);
      if (dragChange) {
        primaryDraggedId = dragChange.id;
      }
    }
    
    // If we have a dragged node, enforce connectivity
    if (primaryDraggedId) {
      const draggedNode = nodes.find(n => n.id === primaryDraggedId);
      const dragChange = changes.find(c => c.id === primaryDraggedId && c.type === 'position');
      
      if (draggedNode && dragChange && dragChange.type === 'position' && dragChange.position) {
        // Calculate delta
        const delta = {
          x: dragChange.position.x - draggedNode.position.x,
          y: dragChange.position.y - draggedNode.position.y
        };

        if (delta.x === 0 && delta.y === 0) {
          set({ nodes: applyNodeChanges(changes, nodes) });
          return;
        }

        // BFS to find all downstream nodes (directed descendants)
        const connectedNodeIds = new Set<string>();
        const queue = [primaryDraggedId];
        connectedNodeIds.add(primaryDraggedId);

        let head = 0;
        while (head < queue.length) {
          const currentId = queue[head++];
          
          // Find only downstream neighbors (where currentId is the source)
          for (const edge of edges) {
            if (edge.source === currentId && !connectedNodeIds.has(edge.target)) {
              connectedNodeIds.add(edge.target);
              queue.push(edge.target);
            }
          }
        }
          
        // Filter changes: Only allow position changes for nodes that are in the connected set
        const filteredChanges = changes.filter(c => {
          if (c.type === 'position' && c.dragging) {
            return connectedNodeIds.has(c.id);
          }
          return true;
        });

        if (connectedNodeIds.size > 1) {
          // Apply the same delta to all connected nodes
          const updatedNodes = nodes.map(node => {
            // React Flow handles the dragged node via applyNodeChanges, 
            // but we need to move the OTHERS in the component.
            if (connectedNodeIds.has(node.id) && node.id !== primaryDraggedId) {
              return {
                ...node,
                position: {
                  x: node.position.x + delta.x,
                  y: node.position.y + delta.y
                }
              };
            }
            return node;
          });
          
          set({ nodes: applyNodeChanges(filteredChanges, updatedNodes) });
          return;
        } else {
           // Enforce that UNCONNECTED selected nodes don't move
          set({ nodes: applyNodeChanges(filteredChanges, nodes) });
          return;
        }
      }
    }

    set({
      nodes: applyNodeChanges(changes, nodes),
    });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },
  setNodes: (nodes: Node[]) => set({ nodes }),
  setEdges: (edges: Edge[]) => set({ edges }),
  addNode: (node: Node) => set({ nodes: [...get().nodes, node] }),
  removeNode: (nodeId: string) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
    });
  },
  updateNodeData: (nodeId: string, data: Record<string, any>) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      }),
    });
  },
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => {
    set(state => ({
      nodes: state.nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, position };
        }
        return node;
      }),
    }));
  },
  addEdge: (edge: Edge) => set({ edges: [...get().edges, edge] }),
  removeEdge: (edgeId: string) => set({ edges: get().edges.filter(e => e.id !== edgeId) }),
  duplicateNode: (nodeId: string) => {
    const { nodes } = get();
    const nodeToDuplicate = nodes.find(n => n.id === nodeId);
    if (!nodeToDuplicate) return;

    const newNodeId = `${nodeToDuplicate.type}-${Date.now()}`;
    const newNode: Node = {
      ...nodeToDuplicate,
      id: newNodeId,
      selected: true,
      position: {
        x: nodeToDuplicate.position.x + 50,
        y: nodeToDuplicate.position.y + 50,
      },
      data: {
        ...nodeToDuplicate.data,
        createdAt: Date.now(),
      }
    };

    // Deselect all nodes and add the new one
    set({
      nodes: [
        ...nodes.map(n => ({ ...n, selected: false })),
        newNode
      ]
    });
  },
}));

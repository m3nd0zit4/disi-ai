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
  transformNode: (oldId: string, newId: string, newType: string, dataUpdates?: Record<string, any>) => void;
  draggedNodeId: string | null;
  setDraggedNodeId: (id: string | null) => void;
  selectedNodeIdForToolbar: string | null;
  setSelectedNodeIdForToolbar: (id: string | null) => void;
  viewport: Viewport | null;
  /** Pane dimensions (from React Flow) so we can pass viewport with width/height to layout. */
  paneDimensions: { width: number; height: number } | null;
  setViewport: (canvasId: string, viewport: Viewport) => void;
  setPaneDimensions: (dimensions: { width: number; height: number } | null) => void;
  loadViewport: (canvasId: string) => void;
  /** Set to a node id to request focus/center on that node (Editor-Canvas consumes and clears). */
  focusNodeId: string | null;
  setFocusNodeId: (id: string | null) => void;
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
  paneDimensions: null as { width: number; height: number } | null,
  isKnowledgePanelOpen: false,
  setKnowledgePanelOpen: (isOpen: boolean) => set({ isKnowledgePanelOpen: isOpen }),

  setPaneDimensions: (dimensions) => set({ paneDimensions: dimensions }),

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
  focusNodeId: null as string | null,
  setFocusNodeId: (id) => set({ focusNodeId: id }),
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
  setNodes: (nodes: Node[]) => {
    const byId = new Map<string, Node>();
    nodes.forEach((n) => byId.set(n.id, n));
    set({ nodes: Array.from(byId.values()) });
  },
  setEdges: (edges: Edge[]) => {
    const byId = new Map<string, Edge>();
    edges.forEach((e) => byId.set(e.id, e));
    set({ edges: Array.from(byId.values()) });
  },
  addNode: (node: Node) => {
    const nodes = get().nodes.filter((n) => n.id !== node.id);
    set({ nodes: [...nodes, node] });
  },
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
  addEdge: (edge: Edge) => {
    const edges = get().edges.filter((e) => e.id !== edge.id);
    set({ edges: [...edges, edge] });
  },
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
  transformNode: (oldId: string, newId: string, newType: string, dataUpdates?: Record<string, any>) => {
    const { nodes, edges } = get();

    // Transform the node: change ID, type, and optionally data
    const updatedNodes = nodes.map(node => {
      if (node.id === oldId) {
        return {
          ...node,
          id: newId,
          type: newType,
          data: {
            ...node.data,
            ...dataUpdates,
          }
        };
      }
      return node;
    });

    // Update all edges that reference the old ID
    const updatedEdges = edges.map(edge => {
      let updated = { ...edge };
      if (edge.source === oldId) {
        updated = { ...updated, source: newId, id: edge.id.replace(oldId, newId) };
      }
      if (edge.target === oldId) {
        updated = { ...updated, target: newId, id: edge.id.replace(oldId, newId) };
      }
      return updated;
    });

    set({ nodes: updatedNodes, edges: updatedEdges });
  },
}));

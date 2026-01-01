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
} from "@xyflow/react";

interface CanvasState {
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
  addEdge: (edge: Edge) => void;
  removeEdge: (edgeId: string) => void;
  duplicateNode: (nodeId: string) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  onNodesChange: (changes: NodeChange[]) => {
    const { nodes, edges } = get();
    
    // Find if any node is being dragged
    const dragChange = changes.find(c => c.type === 'position' && c.dragging) as any;
    
    if (dragChange && dragChange.position) {
      const draggedNode = nodes.find(n => n.id === dragChange.id);
      
      if (draggedNode) {
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
        const queue = [draggedNode.id];
        connectedNodeIds.add(draggedNode.id);

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
          
        if (connectedNodeIds.size > 1) {
          // Apply the same delta to all connected nodes
          const updatedNodes = nodes.map(node => {
            // React Flow handles the dragged node via applyNodeChanges, 
            // but we need to move the OTHERS in the component.
            if (connectedNodeIds.has(node.id) && node.id !== draggedNode.id) {
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
          
          set({ nodes: applyNodeChanges(changes, updatedNodes) });
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

"use client";

import { useEffect, useRef } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { nodeTypes, edgeTypes, defaultEdgeOptions } from "./Flow-Instance";
import { useConnections } from "../providers/ConnectionsProvider";

interface EditorCanvasProps {
  canvasId: string;
  initialNodes?: unknown[];
  initialEdges?: unknown[];
}

export const EditorCanvas = ({ canvasId, initialNodes, initialEdges }: EditorCanvasProps) => {
  const { theme } = useTheme();
  const { nodes, edges, setNodes, setEdges } = useCanvasStore();
  const { 
    onNodesChange,
    onEdgesChange,
    onConnect, 
    onConnectStart, 
    onConnectEnd,
    onNodeDragStart,
    onNodeDragStop,
    onNodeClick,
    onPaneClick,
    onViewportChange
  } = useConnections();

  const { setCenter } = useReactFlow();
  const prevNodeIdsRef = useRef<Set<string>>(new Set());

  // Initialize store and sync with DB updates
  useEffect(() => {
    if (initialNodes) {
      const currentNodes = useCanvasStore.getState().nodes;
      
      // Merge incoming nodes with local selection state to avoid race conditions
      // where a DB update overwrites a local deselection
      const mergedNodes: Node[] = (initialNodes as Node[]).map(incomingNode => {
        const localNode = currentNodes.find(n => n.id === incomingNode.id);
        if (localNode) {
          return {
            ...incomingNode,
            selected: localNode.selected // Preserve local selection state
          };
        }
        return {
          ...incomingNode,
          selected: false // Ensure nodes from DB start deselected
        };
      });

      // Preserve local preview nodes that haven't been saved to DB yet
      const previewNodes = currentNodes.filter(n => n.id.startsWith('preview-'));
      
      // Add preview nodes if they don't exist in the merged list (they shouldn't)
      previewNodes.forEach(previewNode => {
        if (!mergedNodes.find(n => n.id === previewNode.id)) {
          mergedNodes.push(previewNode);
        }
      });

      setNodes(mergedNodes);
    }
    if (initialEdges) setEdges(initialEdges as Edge[]);
    
    // Load viewport from localStorage
    useCanvasStore.getState().loadViewport(canvasId);
  }, [initialNodes, initialEdges, canvasId, setNodes, setEdges]);

  useEffect(() => {
    const currentNodeIds = new Set(nodes.map(n => n.id));
    
    // Skip the first run to avoid auto-panning to existing nodes on load
    if (prevNodeIdsRef.current.size === 0 && currentNodeIds.size > 0) {
      prevNodeIdsRef.current = currentNodeIds;
      return;
    }

    const newNodeIds = Array.from(currentNodeIds).filter(id => !prevNodeIdsRef.current.has(id));

    if (newNodeIds.length > 0) {
      // Find the first new node to center on
      const firstNewNode = nodes.find(n => n.id === newNodeIds[0]);
      if (firstNewNode) {
        // Smoothly pan to the new node
        setCenter(firstNewNode.position.x + 150, firstNewNode.position.y + 100, { zoom: 1, duration: 800 });
      }
    }

    prevNodeIdsRef.current = currentNodeIds;
  }, [nodes, setCenter]);

  return (
    <div className="w-full h-full bg-background relative overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onViewportChange={onViewportChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={false}
        colorMode={theme === 'dark' ? 'dark' : 'light'}
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={defaultEdgeOptions}
        minZoom={0.1}
        maxZoom={2}
        panOnScroll={true}
        zoomOnScroll={false}
        panOnDrag={[0, 1, 2]} // Allow panning with left, middle, and right mouse buttons
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={["Backspace", "Delete"]}
        selectionKeyCode={["Shift"]}
        multiSelectionKeyCode={["Control", "Meta"]}
        proOptions={{ hideAttribution: true }}
      >
        <style jsx global>{`
          .react-flow__node {
            background: none !important;
            border: none !important;
            padding: 0 !important;
            border-radius: 1rem !important;
          }
          .react-flow__node.selected {
            box-shadow: none !important;
            border: none !important;
            outline: none !important;
          }
          .react-flow__controls button {
            background: transparent !important;
            border-bottom: 1px solid var(--border) !important;
            color: var(--foreground) !important;
            fill: currentColor !important;
          }
          .react-flow__controls button:hover {
            background: var(--accent) !important;
          }
        `}</style>
        <Controls 
          showInteractive={false}
          className="!bg-card/40 !backdrop-blur-2xl !border-primary/5 !shadow-2xl !rounded-2xl overflow-hidden !m-4" 
        />
        <MiniMap 
          className="!bg-card/40 !backdrop-blur-2xl !border-primary/5 !shadow-2xl !rounded-2xl overflow-hidden !m-4"
          zoomable 
          pannable 
          nodeColor={(n) => {
            if (n.type === 'input') return 'var(--primary)';
            return 'var(--muted)';
          }}
          maskColor="rgba(var(--background-rgb), 0.6)"
        />
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={12} 
          size={1.5} 
          color={theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)'} 
        />


      </ReactFlow>
    </div>
  );
};

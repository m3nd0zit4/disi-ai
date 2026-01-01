"use client";

import { useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { nodeTypes, defaultEdgeOptions } from "./Flow-Instance";
import { useConnections } from "../providers/ConnectionsProvider";

interface EditorCanvasProps {
  initialNodes?: unknown[];
  initialEdges?: unknown[];
}

export const EditorCanvas = ({ initialNodes, initialEdges }: EditorCanvasProps) => {
  const { theme } = useTheme();
  const { nodes, edges, setNodes, setEdges } = useCanvasStore();
  const { 
    onNodesChange,
    onEdgesChange,
    onConnect, 
    onConnectStart, 
    onConnectEnd
  } = useConnections();

  // Initialize store
  useEffect(() => {
    if (initialNodes) setNodes(initialNodes);
    if (initialEdges) setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div className="w-full h-full bg-background relative overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        nodeTypes={nodeTypes}
        fitView
        colorMode={theme === 'dark' ? 'dark' : 'light'}
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={defaultEdgeOptions}
        minZoom={0.1}
        maxZoom={2}
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

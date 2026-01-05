import { useRef, useEffect } from "react";
import { useCanvasStore } from "@/hooks/useCanvasStore";

export function useNodePreview(
  prompt: string,
  setPrompt: (value: string) => void
) {
  const nodes = useCanvasStore(state => state.nodes);
  const addNode = useCanvasStore(state => state.addNode);
  const updateNodeData = useCanvasStore(state => state.updateNodeData);
  const removeNode = useCanvasStore(state => state.removeNode);
  const addEdge = useCanvasStore(state => state.addEdge);
  const removeEdge = useCanvasStore(state => state.removeEdge);
  
  const previewNodeIdRef = useRef<string | null>(null);
  const previewEdgeIdRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);

  // Targeted selector for the selected input node
  const selectedInputNode = nodes.find(n => n.selected && n.type === 'input' && !n.id.startsWith('preview-'));

  const cleanupPreview = () => {
    if (previewNodeIdRef.current) {
      removeNode(previewNodeIdRef.current);
      previewNodeIdRef.current = null;
    }
    if (previewEdgeIdRef.current) {
      removeEdge(previewEdgeIdRef.current);
      previewEdgeIdRef.current = null;
    }
  };

  const handlePromptChange = (newPrompt: string) => {
    console.log("[useNodePreview] handlePromptChange:", newPrompt);
    setPrompt(newPrompt);

    if (!newPrompt.trim()) {
      cleanupPreview();
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

  // Selection to Prompt Sync
  useEffect(() => {
    if (selectedInputNode) {
      isSyncingRef.current = true;
      setPrompt((selectedInputNode.data.text as string) || "");
      
      // Clear any preview if we just selected an existing node
      cleanupPreview();
      
      const timer = setTimeout(() => { isSyncingRef.current = false; }, 0);
      return () => clearTimeout(timer);
    } else if (!previewNodeIdRef.current && prompt !== "") {
      // Clear prompt immediately when selection is lost and no preview is active
      setPrompt("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInputNode?.id, cleanupPreview, setPrompt, prompt]);

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
  }, [prompt, updateNodeData, addEdge, removeEdge, removeNode]);

  return {
    handlePromptChange,
    cleanupPreview,
    previewNodeIdRef // Expose ref for handleSubmit to use
  };
}

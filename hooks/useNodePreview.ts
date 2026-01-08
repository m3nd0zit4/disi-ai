import { useRef, useEffect, useCallback } from "react";
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

  const cleanupPreview = useCallback(() => {
    if (previewNodeIdRef.current) {
      removeNode(previewNodeIdRef.current);
      previewNodeIdRef.current = null;
    }
    if (previewEdgeIdRef.current) {
      removeEdge(previewEdgeIdRef.current);
      previewEdgeIdRef.current = null;
    }
  }, [removeNode, removeEdge]);

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
      
      // Calculate position: Center below the selected node
      let position = { x: 100, y: 100 };
      
      if (selectedNode) {
        position = { 
            x: selectedNode.position.x + (selectedNode.measured?.width || 500) / 2 - (350 / 2), 
            y: selectedNode.position.y + (selectedNode.measured?.height || 200) + 80 
        };
      } else if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        position = { 
            x: lastNode.position.x + (lastNode.measured?.width || 500) / 2 - (350 / 2), 
            y: lastNode.position.y + (lastNode.measured?.height || 200) + 80
        };
      }

      addNode({
        id: newNodeId,
        type: "input",
        position,
        data: { 
          text: newPrompt,
          createdAt: Date.now()
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
  const lastSelectedNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedInputNode) {
      isSyncingRef.current = true;
      setPrompt((selectedInputNode.data.text as string) || "");
      
      // Clear any preview if we just selected an existing node
      cleanupPreview();
      
      lastSelectedNodeIdRef.current = selectedInputNode.id;
      const timer = setTimeout(() => { isSyncingRef.current = false; }, 0);
      return () => clearTimeout(timer);
    } else if (lastSelectedNodeIdRef.current) {
      // If we had a selection and now we don't, clear the prompt
      setPrompt("");
      lastSelectedNodeIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInputNode?.id, cleanupPreview]);

  // Track the last node we positioned the preview for to avoid loops
  const lastPositionedNodeIdRef = useRef<string | null>(null);
  const lastPositionRef = useRef<{x: number, y: number} | null>(null);

  // Real-time update ONLY effect
  useEffect(() => {
    if (isSyncingRef.current || !prompt.trim()) return;

    const currentNodes = useCanvasStore.getState().nodes;
    const selectedInputNode = currentNodes.find(n => n.selected && n.type === 'input' && !n.id.startsWith('preview-'));

    // If editing an existing node (Two-way sync: Prompt -> Node)
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
        // Update position to follow selection (Epicenter logic)
        const newNodeX = selectedNode.position.x + (selectedNode.measured?.width || 500) / 2 - (previewNode.measured?.width || 350) / 2;
        const newNodeY = selectedNode.position.y + (selectedNode.measured?.height || 200) + 80;

        // Defensive check for NaN
        if (isNaN(newNodeX) || isNaN(newNodeY)) return;

        // Only update if the position has actually changed significantly
        const hasMoved = !lastPositionRef.current || 
                         Math.abs(lastPositionRef.current.x - newNodeX) > 1 || 
                         Math.abs(lastPositionRef.current.y - newNodeY) > 1 ||
                         lastPositionedNodeIdRef.current !== selectedNode.id;

        if (hasMoved) {
          lastPositionRef.current = { x: newNodeX, y: newNodeY };
          lastPositionedNodeIdRef.current = selectedNode.id;
          
          // Use setNodes to update position
          const updatedNodes = currentNodes.map(n => 
            n.id === previewNode.id ? { ...n, position: { x: newNodeX, y: newNodeY } } : n
          );
          useCanvasStore.getState().setNodes(updatedNodes);
        }

        // Ensure edge exists and connects to the current selection
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
        // If selection is lost, remove the edge to make it standalone
        removeEdge(previewEdgeIdRef.current);
        previewEdgeIdRef.current = null;
      }
    }
  }, [prompt, updateNodeData, addEdge, removeEdge]);



  return {
    handlePromptChange,
    cleanupPreview,
    previewNodeIdRef, // Expose ref for handleSubmit to use
  };
}

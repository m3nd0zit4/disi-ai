import { useRef, useEffect, useCallback } from "react";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { Node } from "@xyflow/react";

// Helper to find an empty space on the canvas
const findEmptySpace = (
  startPos: { x: number; y: number },
  width: number,
  height: number,
  existingNodes: Node[],
  padding = 60
) => {
  const currentPos = { ...startPos };
  let attempts = 0;
  const maxAttempts = 20;
  const step = 40;

  while (attempts < maxAttempts) {
    const overlap = existingNodes.some(node => {
      const nodeWidth = node.measured?.width || 300;
      const nodeHeight = node.measured?.height || 150;
      
      return !(
        currentPos.x + width + padding < node.position.x ||
        currentPos.x > node.position.x + nodeWidth + padding ||
        currentPos.y + height + padding < node.position.y ||
        currentPos.y > node.position.y + nodeHeight + padding
      );
    });

    if (!overlap) return currentPos;

    // Move down and slightly right
    currentPos.y += step;
    if (attempts % 4 === 0) {
      currentPos.x += step;
    }
    attempts++;
  }

  return currentPos;
};

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
  const previewFileNodeIdsRef = useRef<Set<string>>(new Set());
  const previewFileEdgeIdsRef = useRef<Set<string>>(new Set());
  
  const isSyncingRef = useRef(false);
  const hasManuallyMovedRef = useRef(false);

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
    
    // Cleanup file previews
    previewFileNodeIdsRef.current.forEach(id => removeNode(id));
    previewFileNodeIdsRef.current.clear();
    previewFileEdgeIdsRef.current.forEach(id => removeEdge(id));
    previewFileEdgeIdsRef.current.clear();
    
    hasManuallyMovedRef.current = false;
  }, [removeNode, removeEdge]);

  const ensureInputPreview = useCallback((currentNodes: Node[]) => {
    // Robust check: If we have a ref, verify the node still exists in the current state
    if (previewNodeIdRef.current) {
      const exists = currentNodes.some(n => n.id === previewNodeIdRef.current);
      if (exists) return previewNodeIdRef.current;
      // If it doesn't exist (e.g. deleted by user), clear the ref to allow recreation
      previewNodeIdRef.current = null;
    }

    const selectedNode = currentNodes.find(n => n.selected && !n.id.startsWith('preview-'));
    
    // If a real input node is selected, use it as the hub directly
    if (selectedNode && selectedNode.type === 'input') {
      return selectedNode.id;
    }

    const newNodeId = `preview-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    previewNodeIdRef.current = newNodeId;
    
    // Calculate position: Center below the selected node
    let startPos = { x: 100, y: 100 };
    
    if (selectedNode) {
      startPos = { 
          x: selectedNode.position.x + (selectedNode.measured?.width || 500) / 2 - (350 / 2), 
          y: selectedNode.position.y - 250 // Place ABOVE as requested
      };
    } else if (currentNodes.length > 0) {
      const lastNode = currentNodes[currentNodes.length - 1];
      startPos = { 
          x: lastNode.position.x + (lastNode.measured?.width || 500) / 2 - (350 / 2), 
          y: lastNode.position.y - 250
      };
    }

    // If we have a selected node or context, we ignore collision for the hub as requested
    const position = selectedNode ? startPos : findEmptySpace(startPos, 350, 200, currentNodes);

    addNode({
      id: newNodeId,
      type: "preview-input",
      position,
      data: { 
        text: prompt || "",
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

    return newNodeId;
  }, [addNode, addEdge, prompt]);

  const addPreviewFile = useCallback((file: { name: string, type: string, size: number, preview?: string }) => {
    const currentNodes = useCanvasStore.getState().nodes;
    const hubId = ensureInputPreview(currentNodes);
    
    const inputPreview = useCanvasStore.getState().nodes.find(n => n.id === hubId);
    if (!inputPreview) return null;

    const nodeId = `preview-file-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Position file preview ABOVE the input preview (Hub)
    const existingFileCount = previewFileNodeIdsRef.current.size;
    const offset = existingFileCount * 220; // 220px spacing
    
    // Center the row of files above the hub
    // We'll adjust the startPos.x based on the total number of files later if needed, 
    // but for now, let's just stack them horizontally starting from the hub's center.
    const startPos = {
      x: inputPreview.position.x + (inputPreview.measured?.width || 350) / 2 - 100 + offset,
      y: inputPreview.position.y - 180 // 180px above the hub
    };

    const position = findEmptySpace(startPos, 200, 100, useCanvasStore.getState().nodes);

    addNode({
      id: nodeId,
      type: "preview-file",
      position,
      data: {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadStatus: "uploading",
        previewUrl: file.preview,
        createdAt: Date.now(),
        isPreview: true
      },
    });

    // Connection: File -> Hub (as per diagram)
    const edgeId = `edge-preview-file-${nodeId}`;
    addEdge({
      id: edgeId,
      source: nodeId,
      target: hubId,
      animated: true,
    });

    previewFileNodeIdsRef.current.add(nodeId);
    previewFileEdgeIdsRef.current.add(edgeId);

    return nodeId;
  }, [addNode, addEdge, ensureInputPreview]);

  const handlePromptChange = (newPrompt: string) => {
    setPrompt(newPrompt);

    if (!newPrompt.trim() && previewFileNodeIdsRef.current.size === 0) {
      cleanupPreview();
      return;
    }

    // If we have files but no prompt, ensure the hub exists
    if (newPrompt.trim() || previewFileNodeIdsRef.current.size > 0) {
      ensureInputPreview(useCanvasStore.getState().nodes);
    }

    // Check if we are editing an existing node
    const selectedInputNode = nodes.find(n => n.selected && n.type === 'input' && !n.id.startsWith('preview-'));
    if (selectedInputNode) return;
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

  // Track manual movements
  useEffect(() => {
    if (!previewNodeIdRef.current) return;
    
    const previewNode = nodes.find(n => n.id === previewNodeIdRef.current);
    if (previewNode?.dragging) {
      hasManuallyMovedRef.current = true;
    }
  }, [nodes]);

  // Real-time update ONLY effect
  useEffect(() => {
    if (isSyncingRef.current) return;
    if (!prompt.trim() && previewFileNodeIdsRef.current.size === 0) return;

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
      
      // Only auto-follow if the user hasn't manually moved it
      if (!hasManuallyMovedRef.current) {
        const selectedNode = currentNodes.find(n => n.selected && !n.id.startsWith('preview-'));
        const previewNode = currentNodes.find(n => n.id === previewNodeIdRef.current);

        if (previewNode && selectedNode) {
          const newNodeX = selectedNode.position.x + (selectedNode.measured?.width || 500) / 2 - (previewNode.measured?.width || 350) / 2;
          const newNodeY = selectedNode.position.y - 250; // Use -250 as requested

          if (!isNaN(newNodeX) && !isNaN(newNodeY)) {
            const updatedNodes = currentNodes.map(n => 
              n.id === previewNode.id ? { ...n, position: { x: newNodeX, y: newNodeY } } : n
            );
            useCanvasStore.getState().setNodes(updatedNodes);
          }
        }
      }

      // Ensure edge exists and connects to the current selection
      const selectedNode = currentNodes.find(n => n.selected && !n.id.startsWith('preview-'));
      if (selectedNode) {
        const currentEdges = useCanvasStore.getState().edges;
        // Only look for the context edge (from selected node to hub)
        // We identify it because it's NOT a file preview edge
        const existingContextEdge = currentEdges.find(e => 
          e.target === previewNodeIdRef.current && 
          !e.id.startsWith('edge-preview-file-')
        );
        
        if (!existingContextEdge || existingContextEdge.source !== selectedNode.id) {
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
      }
    }
  }, [prompt, updateNodeData, addEdge, removeEdge]);

  return {
    handlePromptChange,
    cleanupPreview,
    addPreviewFile,
    previewNodeIdRef,
  };
}

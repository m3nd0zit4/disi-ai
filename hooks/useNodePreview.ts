import { useRef, useEffect, useCallback } from "react";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { Node } from "@xyflow/react";
import { SelectedModel } from "@/types/AiModel";
import { findBestPosition } from "@/lib/canvas/layout";

export function useNodePreview(
  prompt: string,
  setPrompt: (value: string) => void,
  selectedModels: SelectedModel[] = []
) {
  const nodes = useCanvasStore(state => state.nodes);
  const edges = useCanvasStore(state => state.edges);
  const addNode = useCanvasStore(state => state.addNode);
  const updateNodeData = useCanvasStore(state => state.updateNodeData);
  const removeNode = useCanvasStore(state => state.removeNode);
  const addEdge = useCanvasStore(state => state.addEdge);
  const removeEdge = useCanvasStore(state => state.removeEdge);
  
  const previewNodeIdRef = useRef<string | null>(null);
  const previewEdgeIdRef = useRef<string | null>(null);
  const previewFileNodeIdsRef = useRef<Set<string>>(new Set());
  const previewFileEdgeIdsRef = useRef<Set<string>>(new Set());
  const previewResponseNodeIdsRef = useRef<string[]>([]);
  const previewResponseEdgeIdsRef = useRef<Set<string>>(new Set());
  
  const isSyncingRef = useRef(false);
  const hasManuallyMovedPerAnchorMap = useRef<Record<string, boolean>>({});
  
  const DEFAULT_PREVIEW_MODEL = "gpt-5.2";

  // Targeted selector for the selected input node (including preview-input)
  const selectedInputNode = nodes.find(n => n.selected && (n.type === 'input' || n.type === 'preview-input'));

  const cleanupPreview = useCallback(() => {
    // Don't cleanup if the preview node is currently selected (user might be editing it)
    const currentNodes = useCanvasStore.getState().nodes;
    const isPreviewSelected = currentNodes.some(n => n.id === previewNodeIdRef.current && n.selected);
    if (isPreviewSelected) return;

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

    // Cleanup response previews
    previewResponseNodeIdsRef.current.forEach(id => removeNode(id));
    previewResponseNodeIdsRef.current = [];
    previewResponseEdgeIdsRef.current.forEach(id => removeEdge(id));
    previewResponseEdgeIdsRef.current.clear();
    
    // We don't necessarily need to clear the map, but we can if we want to reset state for this preview session
    // hasManuallyMovedPerAnchorMap.current = {}; 
  }, [removeNode, removeEdge]);

  const ensureInputPreview = useCallback((currentNodes: Node[], currentPrompt?: string) => {
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
    
    // Calculate position using intelligent layout
    const newNodeSize = { width: 350, height: 200 };
    
    // Determine if we have an explicit selection
    const isExplicitSelection = !!selectedNode;
    
    // If no selection, we do NOT fallback to the last node.
    // "si no hay nodo seleccionado eso quiere decir que es una conversacion nueva"
    const anchorNodeId = selectedNode?.id;

    const position = findBestPosition({
      nodes: currentNodes,
      edges: useCanvasStore.getState().edges,
      anchorNodeId: anchorNodeId,
      newNodeId: newNodeId, // NEW: Pass the preview ID so it can be excluded from siblings check
      newNodeSize,
      newNodeType: "preview-input",
      isExplicitSelection
    });

    addNode({
      id: newNodeId,
      type: "preview-input",
      position,
      data: { 
        text: currentPrompt || "",
        createdAt: Date.now()
      }
    });

    if (anchorNodeId) {
      const newEdgeId = `edge-preview-${Date.now()}`;
      previewEdgeIdRef.current = newEdgeId;
      addEdge({
        id: newEdgeId,
        source: anchorNodeId,
        target: newNodeId,
        animated: true,
      });
    }

    return newNodeId;
  }, [addNode, addEdge]);

  const addPreviewFile = useCallback((file: { name: string, type: string, size: number, preview?: string }) => {
    const currentNodes = useCanvasStore.getState().nodes;
    const hubId = ensureInputPreview(currentNodes, prompt);
    
    const inputPreview = useCanvasStore.getState().nodes.find(n => n.id === hubId);
    if (!inputPreview) return null;

    const nodeId = `preview-file-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Position file preview ABOVE the input preview (Hub)
    const existingFileCount = previewFileNodeIdsRef.current.size;
    const FILE_WIDTH = 350;
    const SPACING = 20;
    const totalWidth = (existingFileCount + 1) * FILE_WIDTH + existingFileCount * SPACING;
    
    const startX = inputPreview.position.x + (inputPreview.measured?.width || 350) / 2 - (totalWidth / 2);
    const position = {
      x: startX + existingFileCount * (FILE_WIDTH + SPACING),
      y: inputPreview.position.y - 250 // 250px above the hub
    };

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
  }, [addNode, addEdge, ensureInputPreview, prompt]);

  const handlePromptChange = useCallback((newPrompt: string) => {
    setPrompt(newPrompt);

    if (!newPrompt.trim() && previewFileNodeIdsRef.current.size === 0) {
      cleanupPreview();
      return;
    }

    // If we have files but no prompt, ensure the hub exists
    if (newPrompt.trim() || previewFileNodeIdsRef.current.size > 0) {
      const hubId = ensureInputPreview(useCanvasStore.getState().nodes, newPrompt);
      // Direct update to ensure synchronization
      if (hubId) {
        updateNodeData(hubId, { text: newPrompt });
      }
    }

    // Check if we are editing an existing node
    const selectedInputNode = nodes.find(n => n.selected && (n.type === 'input' || n.type === 'preview-input'));
    if (selectedInputNode && selectedInputNode.id !== previewNodeIdRef.current) {
      updateNodeData(selectedInputNode.id, { text: newPrompt });
    }
  }, [cleanupPreview, ensureInputPreview, nodes, setPrompt, updateNodeData]);

  // Selection to Prompt Sync
  const lastSelectedNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedInputNode) {
      isSyncingRef.current = true;
      setPrompt((selectedInputNode.data.text as string) || "");
      
      // Clear any preview ONLY if we selected a REAL input node
      // If we selected a preview node, we want to keep it!
      if (selectedInputNode.type === 'input') {
        cleanupPreview();
      }
      
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
      hasManuallyMovedPerAnchorMap.current[previewNodeIdRef.current] = true;
    }
  }, [nodes]);

  // Real-time update ONLY effect
  useEffect(() => {
    if (isSyncingRef.current) return;
    if (!prompt.trim() && previewFileNodeIdsRef.current.size === 0) return;

    const currentNodes = useCanvasStore.getState().nodes;
    const selectedInputNode = currentNodes.find(n => n.selected && (n.type === 'input' || n.type === 'preview-input'));

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
      if (!hasManuallyMovedPerAnchorMap.current[previewNodeIdRef.current]) {
        const selectedNode = currentNodes.find(n => n.selected && !n.id.startsWith('preview-'));
        const previewNode = currentNodes.find(n => n.id === previewNodeIdRef.current);

        if (previewNode) {
          const newNodeSize = { 
            width: previewNode.measured?.width || 350, 
            height: previewNode.measured?.height || 200 
          };
          
          // Determine anchor and explicit selection
          const isExplicitSelection = !!selectedNode;
          const anchorNodeId = selectedNode?.id;

          const newPos = findBestPosition({
            nodes: currentNodes.filter(n => n.id !== previewNode.id),
            edges: useCanvasStore.getState().edges,
            anchorNodeId: anchorNodeId,
            newNodeId: previewNode.id, // NEW: Pass the ID to ensure it's excluded
            newNodeSize,
            newNodeType: "preview-input",
            isExplicitSelection
          });

          if (!isNaN(newPos.x) && !isNaN(newPos.y)) {
            const updatedNodes = currentNodes.map(n => 
              n.id === previewNode.id ? { ...n, position: newPos } : n
            );
            useCanvasStore.getState().setNodes(updatedNodes);
          }
        }
      }

      // Ensure edge exists and connects to the current selection
      const selectedNode = currentNodes.find(n => n.selected && !n.id.startsWith('preview-'));
      // Logic for edge connection needs to handle fallback anchor too?
      // For now, let's keep edge logic tied to selection, or if no selection, maybe last node?
      // The user requirement specifically mentioned "Selection -> Branch".
      // If no selection, it just stacks.
      
      if (selectedNode) {
        const currentEdges = useCanvasStore.getState().edges;
        // Only look for the context edge (from selected node to hub)
        // We identify it because it's NOT a file preview edge
        const existingContextEdge = currentEdges.find(e => 
          e.target === previewNodeIdRef.current && 
          !e.id.startsWith('edge-preview-file-') &&
          !e.id.startsWith('edge-preview-response-')
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
      } else {
         // If no selection, we might want to connect to the "last node" if we are stacking?
         // But usually we don't show edge until execution if it's just a new prompt at bottom?
         // Actually, if we are positioning relative to last node, we probably should show edge?
         // Let's stick to: If explicit selection, show edge. If not, maybe don't show edge yet?
         // Or show edge to last node?
         // Current behavior seems to be: only connect if selected.
         // Let's respect that for now to avoid clutter.
      }
    }
  }, [prompt, updateNodeData, addEdge, removeEdge]);

  // Response Previews Sync
  useEffect(() => {
    if (isSyncingRef.current) return;
    if (!previewNodeIdRef.current) return;

    // Use reactive nodes/edges from the hook scope
    const inputPreview = nodes.find(n => n.id === previewNodeIdRef.current);
    if (!inputPreview) return;

    const modelsToPreview = selectedModels.length > 0 ? selectedModels : [{ modelId: DEFAULT_PREVIEW_MODEL }];
    
    // Sync response nodes
    const currentResponseIds = [...previewResponseNodeIdsRef.current];
    
    // Remove extra nodes
    if (currentResponseIds.length > modelsToPreview.length) {
      const toRemove = currentResponseIds.slice(modelsToPreview.length);
      toRemove.forEach(id => {
        removeNode(id);
        removeEdge(`edge-preview-response-${id}`);
        previewResponseEdgeIdsRef.current.delete(`edge-preview-response-${id}`);
      });
      // Update ref to match
      previewResponseNodeIdsRef.current = currentResponseIds.slice(0, modelsToPreview.length);
    }

    // Add or update nodes
    modelsToPreview.forEach((model, i) => {
      const existingId = previewResponseNodeIdsRef.current[i];
      
      if (existingId) {
        // Update existing node
        updateNodeData(existingId, { modelId: model.modelId });
        // Update position if not dragging
        const node = nodes.find(n => n.id === existingId);
        if (node && !node.dragging && !hasManuallyMovedPerAnchorMap.current[previewNodeIdRef.current!]) {
          const responseNodeSize = { width: 350, height: 250 };
          const responseNodePos = findBestPosition({
            nodes: nodes.filter(n => n.id !== existingId),
            edges: edges,
            anchorNodeId: inputPreview.id,
            newNodeSize: responseNodeSize,
            newNodeType: "preview-response",
            isParallel: true,
            parallelIndex: i,
            totalParallel: modelsToPreview.length
          });

          // We can't use setNodes directly on the reactive 'nodes' array as it's read-only from store
          // We must use the store action. 
          // However, setNodes replaces ALL nodes.
          // To avoid race conditions with other updates, we should probably use updateNodeData if possible, 
          // but updateNodeData only updates data, not position.
          // So we must use setNodes or a specific updateNodePosition action if it existed.
          // Assuming setNodes is safe enough here if we base it on the latest 'nodes'.
          useCanvasStore.getState().setNodes(
            nodes.map(n => 
              n.id === existingId ? { ...n, position: responseNodePos } : n
            )
          );
        }
      } else {
        // Add new node
        const nodeId = `preview-response-${Date.now()}-${i}`;
        const responseNodeSize = { width: 350, height: 250 };
        const responseNodePos = findBestPosition({
          nodes: nodes,
          edges: edges,
          anchorNodeId: inputPreview.id,
          newNodeSize: responseNodeSize,
          newNodeType: "preview-response",
          isParallel: true,
          parallelIndex: i,
          totalParallel: modelsToPreview.length
        });

        addNode({
          id: nodeId,
          type: "preview-response",
          position: responseNodePos,
          data: {
            modelId: model.modelId,
            status: "pending",
            createdAt: Date.now(),
          },
        });

        const edgeId = `edge-preview-response-${nodeId}`;
        addEdge({
          id: edgeId,
          source: inputPreview.id,
          target: nodeId,
          animated: true,
        });

        previewResponseNodeIdsRef.current.push(nodeId);
        previewResponseEdgeIdsRef.current.add(edgeId);
      }
    });
  }, [selectedModels, nodes, edges, updateNodeData, addNode, addEdge, removeNode, removeEdge]);

  return {
    handlePromptChange,
    cleanupPreview,
    addPreviewFile,
    previewNodeIdRef,
  };
}

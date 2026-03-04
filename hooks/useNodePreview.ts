import { useRef, useEffect, useCallback } from "react";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { Node } from "@xyflow/react";
import { SelectedModel } from "@/types/AiModel";
import { findBestPosition } from "@/lib/canvas/layout";

export function useNodePreview(
  prompt: string,
  setPrompt: (value: string) => void,
  selectedModels: SelectedModel[] = [],
  /** When this changes (selected input node id + text), we sync that node's text into the prompt. */
  selectionSyncKey: string = ""
) {
  // CRITICAL: Don't subscribe to nodes/edges reactively to avoid infinite loops
  // Use imperative getState() calls inside effects instead
  const addNode = useCanvasStore(state => state.addNode);
  const updateNodeData = useCanvasStore(state => state.updateNodeData);
  const updateNodePosition = useCanvasStore(state => state.updateNodePosition);
  const removeNode = useCanvasStore(state => state.removeNode);
  const addEdge = useCanvasStore(state => state.addEdge);
  const removeEdge = useCanvasStore(state => state.removeEdge);
  const transformNode = useCanvasStore(state => state.transformNode);
  
  const previewNodeIdRef = useRef<string | null>(null);
  const previewEdgeIdRef = useRef<string | null>(null);
  const previewFileNodeIdsRef = useRef<Set<string>>(new Set());
  const previewFileEdgeIdsRef = useRef<Set<string>>(new Set());
  
  const isSyncingRef = useRef(false);
  const hasManuallyMovedPerAnchorMap = useRef<Record<string, boolean>>({});
  const lastSelectedNodeIdRef = useRef<string | null>(null);

  const DEFAULT_PREVIEW_MODEL = "gpt-5.2";
  
  // Cache selectedModels to prevent unnecessary effect re-runs
  const selectedModelsRef = useRef<SelectedModel[]>(selectedModels);
  const prevSelectedModelsJsonRef = useRef<string>("");

  const cleanupPreview = useCallback((force: boolean = false) => {
    // Don't cleanup if the preview node is currently selected (user might be editing it)
    // UNLESS force is true (e.g., when submitting)
    if (!force) {
      const currentNodes = useCanvasStore.getState().nodes;
      const isPreviewSelected = currentNodes.some(n => n.id === previewNodeIdRef.current && n.selected);
      if (isPreviewSelected) return;
    }

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

    // Clear the manual movement map to reset state for next preview session
    hasManuallyMovedPerAnchorMap.current = {};
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

    const { viewport: vp, paneDimensions } = useCanvasStore.getState();
    const viewportForLayout =
      vp && paneDimensions && paneDimensions.width > 0 && paneDimensions.height > 0
        ? { ...vp, width: paneDimensions.width, height: paneDimensions.height }
        : undefined;

    const position = findBestPosition({
      nodes: currentNodes,
      edges: useCanvasStore.getState().edges,
      anchorNodeId: anchorNodeId,
      newNodeId: newNodeId,
      newNodeSize,
      newNodeType: "preview-input",
      isExplicitSelection,
      viewport: viewportForLayout,
      skipCollisionAvoidance: true,
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
    const currentNodes = useCanvasStore.getState().nodes;
    const selectedInputNode = currentNodes.find(n => n.selected && (n.type === 'input' || n.type === 'preview-input'));
    if (selectedInputNode && selectedInputNode.id !== previewNodeIdRef.current) {
      updateNodeData(selectedInputNode.id, { text: newPrompt });
    }
  }, [cleanupPreview, ensureInputPreview, setPrompt, updateNodeData]);

  // Selection to Prompt Sync: when user selects an input node, show its text in the chat.
  // When user selects a non-input node (e.g. response), do NOT clear so the preview stays visible.
  // When user deselects (no node selected), clear the ChatInputBox.
  useEffect(() => {
    if (!selectionSyncKey) {
      const currentNodes = useCanvasStore.getState().nodes;
      const anyNodeSelected = currentNodes.some(n => n.selected);
      if (!anyNodeSelected) {
        setPrompt("");
        lastSelectedNodeIdRef.current = null;
      }
      return;
    }
    const currentNodes = useCanvasStore.getState().nodes;
    const selectedInputNode = currentNodes.find(n => n.selected && (n.type === 'input' || n.type === 'preview-input'));
    if (!selectedInputNode) return;

    isSyncingRef.current = true;
    setPrompt((selectedInputNode.data.text as string) || "");

    // Do not cleanup preview when selecting another node; keep preview visible while user is writing.
    // Preview is only cleaned on empty prompt (handlePromptChange / prompt effect) or on submit.
    lastSelectedNodeIdRef.current = selectedInputNode.id;
    const timer = setTimeout(() => {
      isSyncingRef.current = false;
    }, 0);
    return () => clearTimeout(timer);
  }, [selectionSyncKey, setPrompt]);

  // Track manual movements - runs on every render but uses ref so no infinite loop
  useEffect(() => {
    if (!previewNodeIdRef.current) return;
    
    const currentNodes = useCanvasStore.getState().nodes;
    const previewNode = currentNodes.find(n => n.id === previewNodeIdRef.current);
    if (previewNode?.dragging) {
      hasManuallyMovedPerAnchorMap.current[previewNodeIdRef.current] = true;
    }
  });

  // Real-time update ONLY effect - CRITICAL: Only depends on prompt to avoid infinite loops
  useEffect(() => {
    if (isSyncingRef.current) return;
    // When prompt is empty and no file previews, always cleanup (paste/delete-all/clear)
    if (!prompt.trim() && previewFileNodeIdsRef.current.size === 0) {
      cleanupPreview();
      return;
    }

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

          const { viewport: vp, paneDimensions } = useCanvasStore.getState();
          const viewportForLayout =
            vp && paneDimensions && paneDimensions.width > 0 && paneDimensions.height > 0
              ? { ...vp, width: paneDimensions.width, height: paneDimensions.height }
              : undefined;

          const newPos = findBestPosition({
            nodes: currentNodes.filter(n => n.id !== previewNode.id),
            edges: useCanvasStore.getState().edges,
            anchorNodeId: anchorNodeId,
            newNodeId: previewNode.id,
            newNodeSize,
            newNodeType: "preview-input",
            isExplicitSelection,
            viewport: viewportForLayout,
            skipCollisionAvoidance: true,
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
      
      if (selectedNode) {
        const currentEdges = useCanvasStore.getState().edges;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  /**
   * Transform the preview node into a real input node (Flowith Pattern - Optimistic UI)
   * Instead of deleting the preview and creating a new node, we transform it in place.
   * This prevents flickering and provides a seamless user experience.
   *
   * @returns The new permanent node ID, or null if no preview exists
   */
  const transformPreviewToReal = useCallback((): { nodeId: string; position: { x: number; y: number }; parentNodeIds: string[] } | null => {
    const currentNodes = useCanvasStore.getState().nodes;
    const currentEdges = useCanvasStore.getState().edges;

    // Find the preview node
    const previewNode = currentNodes.find(n => n.id === previewNodeIdRef.current);
    if (!previewNode || !previewNodeIdRef.current) {
      return null;
    }

    // Generate permanent ID (strip 'preview-' prefix and create input ID)
    const baseId = previewNodeIdRef.current.replace('preview-', '');
    const permanentId = `input-${baseId}`;

    // Find parent nodes from the preview edges
    const previewEdges = currentEdges.filter(e => e.target === previewNodeIdRef.current);
    const parentNodeIds = [...new Set(previewEdges.map(e => e.source))];

    // Store position before transformation
    const position = { ...previewNode.position };

    // Transform the preview node into a real input node
    transformNode(
      previewNodeIdRef.current,
      permanentId,
      'input',
      {
        status: 'optimistic', // Mark as optimistic until backend confirms
        transformedAt: Date.now()
      }
    );

    // Also transform any preview file nodes connected to this preview
    previewFileNodeIdsRef.current.forEach(filePreviewId => {
      const fileNode = currentNodes.find(n => n.id === filePreviewId);
      if (fileNode) {
        const permanentFileId = filePreviewId.replace('preview-file-', 'file-');
        transformNode(
          filePreviewId,
          permanentFileId,
          'file',
          { status: 'optimistic', isPreview: false }
        );
      }
    });

    // Clear refs (the nodes still exist, just with new IDs)
    previewNodeIdRef.current = null;
    previewEdgeIdRef.current = null;
    previewFileNodeIdsRef.current.clear();
    previewFileEdgeIdsRef.current.clear();
    hasManuallyMovedPerAnchorMap.current = {};

    return { nodeId: permanentId, position, parentNodeIds };
  }, [transformNode]);

  return {
    handlePromptChange,
    cleanupPreview,
    addPreviewFile,
    previewNodeIdRef,
    transformPreviewToReal,
  };
}

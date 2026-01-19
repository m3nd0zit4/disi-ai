import { ReasoningNode, ReasoningEdge, ReasoningContext, ReasoningContextItem, SemanticRole } from "./types";

/**
 * Resolves the context for a specific node by traversing the graph.
 * It collects outputs from upstream nodes in topological order (or simple dependency order).
 * 
 * @param targetNodeId The ID of the node being executed.
 * @param nodes All nodes in the canvas (or a relevant subset).
 * @param edges All edges in the canvas.
 * @param fetchFileContent Optional callback to fetch file content from external storage (e.g. Redis/S3)
 * @returns Structured reasoning context.
 */
export async function resolveNodeContext(
  targetNodeId: string,
  nodes: ReasoningNode[],
  edges: ReasoningEdge[],
  fetchFileContent?: (storageId: string) => Promise<string | null>
): Promise<ReasoningContext> {
  const contextItems: ReasoningContextItem[] = [];
  const visited = new Set<string>();



  // Perform a BFS/traversal to find all ancestors
  const queue = [targetNodeId];
  const ancestors = new Map<string, ReasoningNode>();
  const ancestorEdges = new Map<string, ReasoningEdge>(); // Map target -> edge (simplified)

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const incoming = edges.filter(e => e.target === currentId);
    for (const edge of incoming) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode && !ancestors.has(sourceNode.id)) {
            ancestors.set(sourceNode.id, sourceNode);
            ancestorEdges.set(sourceNode.id, edge); // Keep track of the edge that led to this node (from the child)
            queue.push(sourceNode.id);
        }
    }
  }

  // Convert map to array and sort topologically (or simply by depth/position)
  // Since we want the context to read naturally, we usually want the oldest ancestors first.
  // The BFS found them in reverse order (closest first).
  // Let's sort them.
  const sortedAncestors = Array.from(ancestors.values()).sort((a, b) => {
      // Sort by creation time if available, or position
      if (typeof a.data.createdAt === 'number' && typeof b.data.createdAt === 'number') {
          return (a.data.createdAt as number) - (b.data.createdAt as number);
      }
      // Fallback to Y position
      return (a.position?.y || 0) - (b.position?.y || 0);
  });

  for (const sourceNode of sortedAncestors) {
    // Determine content
    let content = "";
    if (sourceNode.data.output && typeof sourceNode.data.output === 'string') {
        content = sourceNode.data.output;
    } else if (sourceNode.data.text) {
        content = sourceNode.data.text;
    } else if (sourceNode.data.prompt) {
        content = sourceNode.data.prompt;
    } else if (sourceNode.type === 'file') {
        console.log(`\n[Context] Processing file node: ${sourceNode.id}`);
        console.log(`[Context] File name: ${sourceNode.data.fileName}`);
        console.log(`[Context] Has textContent: ${!!sourceNode.data.textContent}`);
        console.log(`[Context] Has storageId: ${!!sourceNode.data.storageId}`);
        console.log(`[Context] fetchFileContent available: ${!!fetchFileContent}`);
        
        // Handle FileNode content
        if (sourceNode.data.textContent) {
            const textContentStr = typeof sourceNode.data.textContent === 'string' ? sourceNode.data.textContent : String(sourceNode.data.textContent);
            console.log(`[Context] Using textContent from node data (${textContentStr.length} chars)`);
            content = `[File: ${sourceNode.data.fileName}]\n${sourceNode.data.textContent}`;
        } else if (sourceNode.data.storageId && typeof sourceNode.data.storageId === 'string' && fetchFileContent) {
            console.log(`[Context] Fetching content from external storage for storageId: ${sourceNode.data.storageId}`);
            // Try to fetch content from external storage if not present in node data
            try {
                const fetchedContent = await fetchFileContent(sourceNode.data.storageId);
                if (fetchedContent) {
                    console.log(`[Context] ✅ Successfully fetched ${fetchedContent.length} chars from external storage`);
                    content = `[File: ${sourceNode.data.fileName}]\n${fetchedContent}`;
                } else {
                    console.warn(`[Context] ⚠️  No content returned from fetchFileContent`);
                    content = `[File: ${sourceNode.data.fileName} (Content not available)]`;
                }
            } catch (err) {
                console.error(`[Context] ❌ Failed to fetch content for file ${sourceNode.data.fileName}:`, err);
                content = `[File: ${sourceNode.data.fileName} (Error fetching content)]`;
            }
        } else {
            console.log(`[Context] Cannot fetch content - using placeholder`);
            content = `[File: ${sourceNode.data.fileName} (Binary/Image/Processing)]`;
        }
        
        console.log(`[Context] Final content length for file node: ${content.length} chars\n`);
    }

    // Determine role
    let role: SemanticRole = "context";
    
    if (sourceNode.data.role) {
        role = sourceNode.data.role;
    } else if (sourceNode.type === 'input') {
        role = "instruction"; 
    } else if (sourceNode.type === 'display' || sourceNode.type === 'image') {
        role = "knowledge"; 
    } else if (sourceNode.type === 'file') {
        role = "knowledge";
    } else if (sourceNode.type === 'response') {
        role = "history";
    }

    // Determine importance (default to 3)
    const importance = sourceNode.data.importance || 3;

    // Truncate if too long (Initial safety, distillation will do more)
    const MAX_CONTEXT_LENGTH = 15000;
    if (content.length > MAX_CONTEXT_LENGTH) {
        content = content.substring(0, MAX_CONTEXT_LENGTH) + "\n...[truncated]";
    }

    if (content.trim()) {
        const edge = ancestorEdges.get(sourceNode.id);
        contextItems.push({
            sourceNodeId: sourceNode.id,
            nodeType: sourceNode.type,
            role,
            content,
            importance,
            relation: edge?.relation
        });
    }
  }

  return {
    targetNodeId,
    items: contextItems
  };
}

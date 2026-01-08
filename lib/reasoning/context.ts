import { ReasoningNode, ReasoningEdge, ReasoningContext, ReasoningContextItem, SemanticRole } from "./types";

/**
 * Resolves the context for a specific node by traversing the graph.
 * It collects outputs from upstream nodes in topological order (or simple dependency order).
 * 
 * @param targetNodeId The ID of the node being executed.
 * @param nodes All nodes in the canvas (or a relevant subset).
 * @param edges All edges in the canvas.
 * @returns Structured reasoning context.
 */
export function resolveNodeContext(
  targetNodeId: string,
  nodes: ReasoningNode[],
  edges: ReasoningEdge[]
): ReasoningContext {
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
    }

    // Determine role
    let role: SemanticRole = "context";
    
    if (sourceNode.data.role) {
        role = sourceNode.data.role;
    } else if (sourceNode.type === 'input') {
        role = "instruction"; 
    } else if (sourceNode.type === 'display' || sourceNode.type === 'image') {
        role = "knowledge"; // Changed from evidence to knowledge
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

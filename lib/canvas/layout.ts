import { Node, Edge } from "@xyflow/react";

// Constants for layout
const RANK_GAP = 50; // Vertical gap between ranks (Case 1)
const NODE_GAP = 30; // Horizontal gap between siblings (Case 6)
const LATERAL_GAP = 210; // Gap for lateral placement (Case 4) - 210
const MAX_CLUSTER_HEIGHT = 1200; // Case 3: Saturation limit
const COLLISION_PADDING = 20; // Case 8: Padding for collision detection

const DEFAULT_NODE_WIDTH = 350;
const DEFAULT_NODE_HEIGHT = 250;

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutParams {
  nodes: Node[];
  edges?: Edge[];
  anchorNodeId?: string;
  newNodeId?: string; // NEW: ID of the node being positioned
  newNodeSize?: { width: number; height: number };
  newNodeType?: string; // Added to distinguish between stacking (same type) and branching (diff type)
  isParallel?: boolean;
  parallelIndex?: number;
  totalParallel?: number;
  viewport?: { x: number; y: number; zoom: number; width: number; height: number };
  isExplicitSelection?: boolean; // NEW: Forces lateral layout if true
}

/**
 * Determine the width and height for a node.
 *
 * Uses the node's measured dimensions when available; otherwise returns type-specific default dimensions.
 *
 * @param node - The node to evaluate for sizing.
 * @returns An object with `width` and `height` in pixels for the node.
 */
function getNodeSize(node: Node): { width: number; height: number } {
  if (node.measured?.width && node.measured?.height) {
    return { width: node.measured.width, height: node.measured.height };
  }

  // Fallbacks based on type
  switch (node.type) {
    case "response":
    case "preview-response":
    case "display":
      return { width: 350, height: 400 };
    case "input":
    case "preview-input":
      return { width: 350, height: 200 };
    case "file":
    case "preview-file":
      return { width: 350, height: 120 };
    default:
      return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
  }
}

/**
 * Determine whether two axis-aligned rectangles overlap when an optional padding is applied.
 *
 * @param r1 - The first rectangle
 * @param r2 - The second rectangle
 * @param padding - Extra spacing added to each rectangle's edges when checking overlap (defaults to COLLISION_PADDING)
 * @returns `true` if the rectangles overlap or touch within the given padding, `false` otherwise.
 */
function isOverlapping(r1: Rect, r2: Rect, padding = COLLISION_PADDING): boolean {
  return !(
    r1.x + r1.width + padding < r2.x ||
    r1.x > r2.x + r2.width + padding ||
    r1.y + r1.height + padding < r2.y ||
    r1.y > r2.y + r2.height + padding
  );
}

/**
 * Compute the axis-aligned bounding rectangle that encloses all given nodes.
 *
 * @param nodes - The nodes to include when computing the bounds
 * @returns A rect { x, y, width, height } that covers every node's position and size; returns { x: 0, y: 0, width: 0, height: 0 } if `nodes` is empty
 */
function getBounds(nodes: Node[]): Rect {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach(node => {
    const { width, height } = getNodeSize(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Shifts a proposed node position until it no longer overlaps any existing node.
 *
 * Adjusts and returns a modified position by nudging the proposed point to avoid overlaps with the provided existing nodes. When `preferLateral` is true, adjustments keep the X coordinate and move downward to stack in a lateral column; otherwise the function prefers downward nudges and may shift right to escape dense columns. Existing nodes are never moved.
 *
 * @param proposedPos - Initial candidate position for the new node
 * @param size - Width and height of the new node
 * @param existingNodes - Array of nodes to avoid overlapping
 * @param preferLateral - If true, preserve X and only move vertically to form a lateral column
 * @returns A position `{ x, y }` adjusted so it does not overlap any of `existingNodes`
 */
function avoidCollisions(proposedPos: Point, size: { width: number; height: number }, existingNodes: Node[], preferLateral: boolean = false): Point {
  const currentPos = { ...proposedPos };
  let hasCollision = true;
  let attempts = 0;
  const maxAttempts = 100; // Increased attempts to allow for finding a slot in a busy column

  while (hasCollision && attempts < maxAttempts) {
    hasCollision = existingNodes.some(node => {
      const nodeSize = getNodeSize(node);
      return isOverlapping(
        { ...currentPos, ...size },
        { x: node.position.x, y: node.position.y, ...nodeSize }
      );
    });

    if (hasCollision) {
      if (preferLateral) {
         // Strategy for lateral branching:
         // We want to stack vertically in the "lateral column" (to the right of the anchor).
         // So we primarily increment Y to find the next available slot below.
         // We do NOT move X, to keep it aligned.
         currentPos.y += 20;
      } else {
        // Strategy: Nudge down first, then right if still blocked
        // This preserves the "vertical flow" preference
        currentPos.y += 20; 
        // If we've tried nudging down a lot, try shifting right slightly to escape a column
        if (attempts % 10 === 0) {
            currentPos.x += 20;
        }
      }
      attempts++;
    }
  }

  return currentPos;
}

/**
 * Clamp a proposed top-left position so the node's rectangle stays within the visible viewport area with padding.
 *
 * @param pos - The proposed top-left coordinates of the node.
 * @param size - The node's width and height.
 * @param viewport - The current viewport transform and dimensions (`x`, `y`, `zoom`, `width`, `height`).
 * @returns The adjusted position constrained to the viewport's visible region minus a 50px padding on each edge.
 */
function clampToViewport(pos: Point, size: { width: number; height: number }, viewport?: LayoutParams["viewport"]): Point {
  if (!viewport) return pos;

  const visibleMinX = -viewport.x / viewport.zoom;
  const visibleMinY = -viewport.y / viewport.zoom;
  const visibleMaxX = visibleMinX + viewport.width / viewport.zoom;
  const visibleMaxY = visibleMinY + viewport.height / viewport.zoom;

  // Add some padding (e.g. 50px) to ensure it's comfortably inside
  const padding = 50;

  return {
    x: Math.max(visibleMinX + padding, Math.min(pos.x, visibleMaxX - size.width - padding)),
    y: Math.max(visibleMinY + padding, Math.min(pos.y, visibleMaxY - size.height - padding))
  };
}

/**
 * Compute a heuristic top-left position for placing a new node relative to existing nodes and an optional anchor.
 *
 * The function chooses among multiple layout strategies (first-node centering, parallel outputs, explicit user-driven
 * branching or continuation, vertical stacking, lateral placement for follow-ups or saturated clusters), applies
 * collision avoidance against existing nodes, and optionally clamps the result to a provided viewport.
 *
 * @param params - Layout parameters controlling placement:
 *   - anchorNodeId: optional id of the anchor node to attach the new node to
 *   - newNodeId: optional id of the new node (excluded from sibling checks)
 *   - newNodeSize: desired width/height of the new node (defaults provided)
 *   - newNodeType: optional type hint used for follow-up heuristics (e.g., response -> input)
 *   - isParallel / parallelIndex / totalParallel: place multiple parallel outputs centered under the anchor
 *   - viewport: optional viewport used to center the first node or to clamp the final position
 *   - isExplicitSelection: when true, prefer explicit branching/continuation placements described above
 * @returns A Point { x, y } specifying the top-left coordinates where the new node should be placed.
 */
export function findBestPosition(params: LayoutParams): Point {
  const { 
    nodes, 
    edges = [],
    anchorNodeId, 
    newNodeId, // Destructure
    newNodeSize = { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT },
    newNodeType,
    isParallel = false,
    parallelIndex = 0,
    totalParallel = 1,
    viewport,
    isExplicitSelection = false
  } = params;

  // --- Case 0: No Anchor (First node) ---
  if (!anchorNodeId) {
    if (viewport) {
      // Center in viewport
      return {
        x: (-viewport.x + viewport.width / 2) / viewport.zoom - newNodeSize.width / 2,
        y: (-viewport.y + viewport.height / 2) / viewport.zoom - newNodeSize.height / 2
      };
    }
    // Fallback
    return { x: 100, y: 100 };
  }

  const anchorNode = nodes.find(n => n.id === anchorNodeId);
  if (!anchorNode) return { x: 0, y: 0 }; // Should not happen

  const anchorSize = getNodeSize(anchorNode);
  let targetPos: Point = { x: 0, y: 0 };

  // --- Case 6: Parallel Outputs (Comparison) ---
  if (isParallel && totalParallel > 1) {
    // Center the group of parallel nodes under the anchor
    const totalWidth = totalParallel * newNodeSize.width + (totalParallel - 1) * NODE_GAP;
    const groupStartX = anchorNode.position.x + anchorSize.width / 2 - totalWidth / 2;
    
    targetPos = {
      x: groupStartX + parallelIndex * (newNodeSize.width + NODE_GAP),
      y: anchorNode.position.y + anchorSize.height + RANK_GAP
    };
    
    // Check collision for this specific spot
    // Check collision for this specific spot
    targetPos = avoidCollisions(targetPos, newNodeSize, nodes);
    // Do NOT return here, let it flow to viewport clamping
  } else {
    // --- Check for existing children (Branching detection) ---
    const siblings = nodes.filter(n => 
      n.id !== newNodeId && 
      edges.some(e => e.source === anchorNodeId && e.target === n.id)
    );
    const hasChildren = siblings.length > 0;

    // --- CRITICAL CHANGE: Explicit Selection Logic ---
    // If explicitly selected:
    // 1. If it HAS children -> It's a BRANCH -> Lateral Layout (Chain to the right)
    // 2. If it has NO children -> It's a CONTINUATION -> Vertical Layout (Standard)
    if (isExplicitSelection && hasChildren) {
        // Find the "last" sibling to append to the right
        // We sort by creation time to find the latest addition
        const sortedSiblings = [...siblings].sort((a, b) => {
            const tA = (a.data?.createdAt as number) || 0;
            const tB = (b.data?.createdAt as number) || 0;
            return tA - tB; // Ascending
        });
        
        const lastSibling = sortedSiblings[sortedSiblings.length - 1];
        const lastSiblingSize = getNodeSize(lastSibling);

        // Flowith-like behavior: Chain to the right
        // "Si hay dos nodos, se genera al lado derecho del segundo nodo"
        targetPos = {
            x: lastSibling.position.x + lastSiblingSize.width + LATERAL_GAP,
            y: lastSibling.position.y // Align tops
        };
        
        // User explicitly said: "No importa que se superpongan"
        // So we return DIRECTLY, skipping avoidCollisions
        // But we MUST clamp to viewport if provided
        return clampToViewport(targetPos, newNodeSize, viewport);
    }
    
    // If explicitly selected but NO children yet -> First branch
    // We treat this as a "Continuation" in terms of logic (vertical), 
    // But user said: "Si debajo de la respuesta no haya ningún prompt... se genera exactamente abajo"
    // So we place it exactly below and RETURN, bypassing collision detection.
    if (isExplicitSelection && !hasChildren) {
        targetPos = {
          x: anchorNode.position.x + anchorSize.width / 2 - newNodeSize.width / 2,
          y: anchorNode.position.y + anchorSize.height + RANK_GAP
        };
        return clampToViewport(targetPos, newNodeSize, viewport);
    }

    // --- Identify Cluster Context ---
    // (Standard logic continues below for non-branching or first-child cases)

    // Sort siblings by vertical position to find the "bottom" of the stack
    siblings.sort((a, b) => a.position.y - b.position.y);
    
    const lastSibling = siblings[siblings.length - 1];
    const clusterBounds = getBounds([anchorNode, ...siblings]);

    // --- Case 5: Follow-up / New Turn (Branching) ---
    // If we are attaching an INPUT to a RESPONSE, it's a new turn.
    // Or if explicitly requested to branch.
    // We assume if types are different (Response -> Input), it's a follow-up.
    const isFollowUp = (anchorNode.type || 'default').includes('response') && newNodeType?.includes('input');
    
    // --- Case 3: Cluster Saturation ---
    const isClusterSaturated = clusterBounds.height > MAX_CLUSTER_HEIGHT;

    if (isFollowUp || isClusterSaturated) {
      // --- Case 4 & 5: Lateral Placement ---
      // Place to the RIGHT of the anchor/cluster
      // If it's a follow-up, we align with the ANCHOR (top), or maybe slightly below?
      // Usually "Chat" flows: Prompt -> Response -> (Right) Prompt -> Response
      
      // Find the right-most point of the current cluster to avoid overlapping it
      const rightMostX = clusterBounds.x + clusterBounds.width;
      
      targetPos = {
        x: rightMostX + LATERAL_GAP,
        y: anchorNode.position.y // Align top with anchor to create a "row" of turns
      };
    } else {
      // --- Case 1 & 2: Vertical Stacking ---
      if (lastSibling) {
        // Place below the last sibling
        const lastSiblingSize = getNodeSize(lastSibling);
        targetPos = {
          x: anchorNode.position.x + anchorSize.width / 2 - newNodeSize.width / 2, // Center align
          y: lastSibling.position.y + lastSiblingSize.height + RANK_GAP
        };
      } else {
        // First child
        targetPos = {
          x: anchorNode.position.x + anchorSize.width / 2 - newNodeSize.width / 2,
          y: anchorNode.position.y + anchorSize.height + RANK_GAP
        };
      }
    }

    // --- Case 8: Collision Avoidance ---
    // This is the final safety net.
    targetPos = avoidCollisions(targetPos, newNodeSize, nodes);
  }

  // --- Case 7: Viewport Restriction ---
  // Only clamp if we have viewport info.
  // Note: Clamping might force overlap if viewport is full. 
  // Priority: No Overlap > Viewport.
  // So we clamp first, then check collision? Or check collision then clamp?
  // If we clamp, we might move it ONTOP of something.
  // Better: Don't strictly clamp to viewport if it causes collision.
  // But user said "Nunca fuera de cámara".
  // Let's clamp, then check collision again?
  // --- Case 7: Viewport Restriction ---
  if (viewport) {
     const clamped = clampToViewport(targetPos, newNodeSize, viewport);
     
     // If clamped position is different (meaning it was out of bounds)
     if (clamped.x !== targetPos.x || clamped.y !== targetPos.y) {
        // Check if the clamped position causes a collision
        const isSafe = !nodes.some(n => {
            const s = getNodeSize(n);
            return isOverlapping({ ...clamped, ...newNodeSize }, { x: n.position.x, y: n.position.y, ...s });
        });

        if (isSafe) {
            targetPos = clamped;
        } else {
            // Overlap detected at clamped position.
            // Search for a safe spot INSIDE the viewport.
            let bestSafePos: Point | null = null;
            const searchRadius = 500; // Max search radius
            const step = 50;
            
            // Spiral search
            for (let r = step; r <= searchRadius; r += step) {
                for (let angle = 0; angle < 360; angle += 45) {
                    const rad = angle * (Math.PI / 180);
                    const testPos = {
                        x: clamped.x + r * Math.cos(rad),
                        y: clamped.y + r * Math.sin(rad)
                    };
                    
                    // Must be inside viewport
                    const reClamped = clampToViewport(testPos, newNodeSize, viewport);
                    if (reClamped.x !== testPos.x || reClamped.y !== testPos.y) continue; // Skip if out of viewport
                    
                    // Check collision
                    const safe = !nodes.some(n => {
                        const s = getNodeSize(n);
                        return isOverlapping({ ...testPos, ...newNodeSize }, { x: n.position.x, y: n.position.y, ...s });
                    });
                    
                    if (safe) {
                        bestSafePos = testPos;
                        break;
                    }
                }
                if (bestSafePos) break;
            }
            
            if (bestSafePos) {
                targetPos = bestSafePos;
            }
            // If no safe spot found in viewport, we fallback to the original targetPos (which was collision-safe but off-screen)
            // This honors "Nunca fuera de cámara" by trying hard, but prioritizes non-overlap if absolutely impossible?
            // Actually user said: "only if no safe on-screen spot exists... fall back to the original"
            // So we are good.
        }
     }
  }

  return targetPos;
}
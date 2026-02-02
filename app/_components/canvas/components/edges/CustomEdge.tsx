import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useCanvasStore, CanvasState } from '@/hooks/useCanvasStore';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useParams } from 'next/navigation';
import { X } from 'lucide-react';
import { Id } from '@/convex/_generated/dataModel';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  source,
  target,
}: EdgeProps) {
  const params = useParams();
  const canvasId = params.canvasId as Id<"canvas">;

  const addEdgeToStore = useCanvasStore(state => state.addEdge);
  const removeEdgeFromStore = useCanvasStore(state => state.removeEdge);
  const nodes = useCanvasStore((state: CanvasState) => state.nodes);
  const removeEdgeMutation = useMutation(api.canvas.removeEdge);

  const [isHovered, setIsHovered] = React.useState(false);

  // Check if source or target node is selected
  const isConnectedNodeSelected = useMemo(() => {
    return nodes.some(node =>
      (node.id === source || node.id === target) && node.selected
    );
  }, [nodes, source, target]);

  // Combined highlight state
  const isHighlighted = selected || isHovered || isConnectedNodeSelected;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onRemoveEdge = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    // Backend update
    if (canvasId) {
        // Optimistic update
        removeEdgeFromStore(id);

        try {
            await removeEdgeMutation({ canvasId, edgeId: id });
        } catch (error) {
            console.error("Failed to remove edge:", error);
            // Revert
            addEdgeToStore({
                id,
                source,
                target,
                type: 'custom',
                animated: true
            });
        }
    }
  };

  return (
    <>
      {/* Invisible interaction path for easier clicking/hovering */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="cursor-pointer interactive-edge"
        onDoubleClick={onRemoveEdge}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      {/* Minimalist edge - thin and subtle */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: isHighlighted ? 1.5 : 1,
          stroke: isHighlighted ? 'var(--primary)' : (style.stroke || 'var(--muted-foreground)'),
          opacity: isHighlighted ? 0.6 : 0.25,
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease, opacity 0.2s ease',
        }}
        className="transition-all duration-200"
      />

      {/* Delete Button - ALWAYS visible, minimalist style */}
      <EdgeLabelRenderer>
        <div
            style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
            }}
            className="nodrag nopan"
        >
            <button
                type="button"
                aria-label="Remove connection"
                className={cn(
                  "group/btn flex items-center justify-center",
                  "w-5 h-5 rounded-full",
                  "bg-background/80 backdrop-blur-sm",
                  "border border-border/50",
                  "text-muted-foreground/50",
                  "transition-all duration-200 ease-out",
                  // Hover state - more prominent
                  "hover:w-6 hover:h-6",
                  "hover:bg-red-500/10 hover:border-red-500/50",
                  "hover:text-red-500",
                  "hover:shadow-sm",
                  "active:scale-90"
                )}
                onClick={onRemoveEdge}
                title="Click to disconnect"
            >
                <X size={10} className="transition-all duration-200 group-hover/btn:scale-110" />
            </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

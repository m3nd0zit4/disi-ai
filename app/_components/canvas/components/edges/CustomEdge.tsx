import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import React from 'react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/hooks/useCanvasStore';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useParams } from 'next/navigation';
import { Scissors } from 'lucide-react';
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
  const removeEdgeMutation = useMutation(api.canvas.removeEdge);
  
  const [isHovered, setIsHovered] = React.useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onDoubleClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Optimistic update
    removeEdgeFromStore(id);
    
    // Backend update
    if (canvasId) {
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
        onDoubleClick={onDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: (selected || isHovered) ? 3 : 2,
          stroke: (selected || isHovered) ? 'var(--primary)' : style.stroke,
          opacity: (selected || isHovered) ? 0.8 : 0.4,
          transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
        }}
        className={cn(
          "transition-all duration-300",
          (selected || isHovered) ? "opacity-100" : "opacity-60"
        )}
      />
      
      {/* Scissors Icon on Hover */}
      <EdgeLabelRenderer>
        <div
            style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.2s',
            }}
            className="nodrag nopan"
        >
            <button
                type="button"
                aria-label="Disconnect edge"
                className="bg-background border border-border rounded-full p-1 shadow-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onClick={onDoubleClick} 
                title="Double-click edge or click here to disconnect"
            >
                <Scissors size={14} />
            </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

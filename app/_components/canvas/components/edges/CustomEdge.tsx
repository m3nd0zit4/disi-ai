import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/hooks/useCanvasStore';

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
}: EdgeProps) {
  const removeEdge = useCanvasStore(state => state.removeEdge);

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onDoubleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    removeEdge(id);
  };

  return (
    <>
      {/* Invisible interaction path for easier clicking/hovering */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="cursor-scissors interactive-edge"
        onDoubleClick={onDoubleClick}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          stroke: selected ? 'var(--primary)' : style.stroke,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
        className={cn(
          "transition-all duration-300",
          selected ? "opacity-100" : "opacity-60 hover:opacity-100"
        )}
      />
    </>
  );
}

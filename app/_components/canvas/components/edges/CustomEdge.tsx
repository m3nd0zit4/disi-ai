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
      <style jsx global>{`
        .cursor-scissors {
          cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='6' r='3'/><circle cx='6' cy='18' r='3'/><line x1='20' y1='4' x2='8.12' y2='15.88'/><line x1='14.47' y1='14.48' x2='20' y2='20'/><line x1='8.12' y1='8.12' x2='12' y2='12'/></svg>") 12 12, auto !important;
        }
        .interactive-edge:hover + .react-flow__edge-path {
          stroke-width: 3px;
          stroke: var(--primary);
          opacity: 0.8;
        }
      `}</style>
    </>
  );
}

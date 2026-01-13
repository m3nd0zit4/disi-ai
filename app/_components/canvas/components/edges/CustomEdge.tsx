import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import React, { useState } from 'react';
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
  const [isHovered, setIsHovered] = React.useState(false);

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
    </>
  );
}

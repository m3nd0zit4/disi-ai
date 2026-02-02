import { InputNode, ResponseNode, DisplayNode, FileNode } from "./nodes";
import { PreviewInputNode } from "./nodes/preview/PreviewInputNode";
import { PreviewFileNode } from "./nodes/preview/PreviewFileNode";
import CustomEdge from "./edges/CustomEdge";

export const nodeTypes = {
  input: InputNode,
  response: ResponseNode,
  display: DisplayNode,
  file: FileNode,
  "preview-input": PreviewInputNode,
  "preview-file": PreviewFileNode,
};

export const edgeTypes = {
  custom: CustomEdge,
};

export const defaultEdgeOptions = {
  type: 'custom',
  animated: false, // Disable animation for cleaner look
  style: {
    strokeWidth: 1,
    stroke: 'var(--muted-foreground)',
    opacity: 0.25,
  },
};

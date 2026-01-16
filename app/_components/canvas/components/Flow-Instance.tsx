import { InputNode, ResponseNode, DisplayNode, FileNode } from "./nodes";
import { PreviewInputNode } from "./nodes/preview/PreviewInputNode";
import { PreviewFileNode } from "./nodes/preview/PreviewFileNode";
import { PreviewResponseNode } from "./nodes/preview/PreviewResponseNode";
import CustomEdge from "./edges/CustomEdge";

export const nodeTypes = {
  input: InputNode,
  response: ResponseNode,
  display: DisplayNode,
  file: FileNode,
  "preview-input": PreviewInputNode,
  "preview-file": PreviewFileNode,
  "preview-response": PreviewResponseNode,
};

export const edgeTypes = {
  custom: CustomEdge,
};

export const defaultEdgeOptions = {
  type: 'custom',
  animated: true,
  style: {
    strokeWidth: 2,
    stroke: 'var(--primary)',
    opacity: 0.4,
  },
};

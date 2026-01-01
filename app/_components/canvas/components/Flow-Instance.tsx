import { InputNode, ResponseNode, DisplayNode } from "./nodes";

export const nodeTypes = {
  input: InputNode,
  response: ResponseNode,
  display: DisplayNode,
};

export const defaultEdgeOptions = {
  type: 'bezier',
  animated: true,
  style: {
    strokeWidth: 2,
    stroke: 'var(--primary)',
    opacity: 0.4,
  },
};

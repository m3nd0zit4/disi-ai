import { InputNode, ResponseNode, DisplayNode } from "./nodes";
import CustomEdge from "./edges/CustomEdge";

export const nodeTypes = {
  input: InputNode,
  response: ResponseNode,
  display: DisplayNode,
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

import { Connection, Edge, addEdge } from "@xyflow/react";

export const handleWorkflowConnection = (
  connection: Connection,
  edges: Edge[]
): Edge[] => {
  return addEdge({ ...connection, type: 'bezier' }, edges);
};

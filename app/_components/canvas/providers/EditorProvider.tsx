"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { ReactNode } from "react";

interface EditorProviderProps {
  children: ReactNode;
}

export const EditorProvider = ({ children }: EditorProviderProps) => {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
};

import React from "react";
import { FileText, Image as ImageIcon, File } from "lucide-react";
import { isImageType, isTextualType } from "@/lib/file-utils";

interface FileIconDisplayProps {
  fileType: string;
  className?: string;
}

export const FileIconDisplay = ({ fileType, className }: FileIconDisplayProps) => {
  if (isImageType(fileType)) return <ImageIcon className={className} />;
  if (isTextualType(fileType)) return <FileText className={className} />;
  return <File className={className} />;
};

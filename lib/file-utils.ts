/**
 * Shared file utility functions
 */

/**
 * Format file size in bytes to a human-readable string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes <= 0) return "0 B";
  if (bytes >= 1024 * 1024 * 1024 * 1024) return "Too Large"; // Guard against extremely large sizes
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Check if a MIME type represents an image
 */
export const isImageType = (type: string): boolean => type.startsWith("image/");

/**
 * Check if a MIME type represents a textual file
 */
export const isTextualType = (type: string): boolean => {
  const textualTypes = [
    "text/",
    "application/json",
    "application/xml",
    "application/javascript",
    "application/typescript",
  ];
  return textualTypes.some(t => type.toLowerCase().startsWith(t));
};

/**
 * Check if a File object represents a textual file based on MIME type or extension
 */
export const isTextualFile = (file: File): boolean => {
  const textualExtensions = [
    "txt", "md", "py", "js", "ts", "jsx", "tsx", "html", "htm", "css", "scss", "sass",
    "json", "xml", "yaml", "yml", "csv", "sql", "sh", "bash", "php", "rb", "go", "java",
    "c", "cpp", "h", "hpp", "cs", "rs", "swift", "kt", "scala", "r", "vue", "svelte",
    "astro", "config", "conf", "ini", "toml", "log", "gitignore", "dockerfile", "makefile", "readme",
  ];
  
  const isTextualMime = isTextualType(file.type);
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const isTextualExt = textualExtensions.includes(extension) ||
    file.name.toLowerCase().includes("readme") ||
    file.name.toLowerCase().includes("dockerfile") ||
    file.name.toLowerCase().includes("makefile");
    
  return isTextualMime || isTextualExt;
};

/**
 * Read a File object as text
 */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || "");
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

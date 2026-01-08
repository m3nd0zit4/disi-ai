export type ModelOutput = {
  content: {
    markdown?: string;
    imageUrl?: string;
  };
  reasoning?: {
    text: string;
    durationMs?: number;
  };
  status: "loading" | "thinking" | "streaming" | "completed" | "error";
};

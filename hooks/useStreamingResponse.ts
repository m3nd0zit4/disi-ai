import { useState, useEffect } from "react";

export function useStreamingResponse(responseId: string, isInitialStreaming: boolean) {
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(isInitialStreaming);
  const [error, setError] = useState<string | null>(null);
  const [prevResponseId, setPrevResponseId] = useState(responseId);

  // Adjust state during render if responseId changes
  if (responseId !== prevResponseId) {
    setPrevResponseId(responseId);
    setStreamingContent("");
    setError(null);
    setIsStreaming(isInitialStreaming);
  }

  useEffect(() => {
    if (!isInitialStreaming || !responseId) {
      return;
    }

    const eventSource = new EventSource(`/api/ai/stream-sse?responseId=${responseId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.content) {
          setStreamingContent((prev) => prev + data.content);
        }

        if (data.status === "completed") {
          setIsStreaming(false);
          eventSource.close();
        }

        if (data.status === "error") {
          setIsStreaming(false);
          setError(data.error || "Unknown error during streaming");
          eventSource.close();
        }
      } catch {
        console.error(`[Hook] Error parsing SSE data:`);
      }
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [responseId, isInitialStreaming]);

  return { streamingContent, isStreaming, error };
}

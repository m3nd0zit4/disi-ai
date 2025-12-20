import { useState, useCallback } from 'react';
import { ModelResponse } from '@/types/ChatMessage';

export function useModelResponses(initialResponses: ModelResponse[]) {
  const [responses, setResponses] = useState<ModelResponse[]>(initialResponses);

  const [prevInitialResponses, setPrevInitialResponses] = useState(initialResponses);

  // Sync with props when they change (e.g. from DB updates)
  // We use the "adjusting state during render" pattern to avoid useEffect cascading renders
  if (initialResponses !== prevInitialResponses) {
    setPrevInitialResponses(initialResponses);
    setResponses((prev) => {
      const merged = initialResponses.map((newResp) => {
        const existing = prev.find((r) => r.modelId === newResp.modelId);
        if (existing) {
          return {
            ...newResp,
            isExpanded: existing.isExpanded ?? newResp.isExpanded,
          };
        }
        return newResp;
      });

      // Check if the merged result is different from the previous state
      // to avoid unnecessary re-renders.
      const isDifferent = merged.length !== prev.length || 
        merged.some((m, i) => {
          const p = prev[i];
          if (!p) return true;
          return m.content !== p.content || 
                 m.status !== p.status || 
                 m.isLoading !== p.isLoading ||
                 m.isExpanded !== p.isExpanded ||
                 m.mediaUrl !== p.mediaUrl;
        });

      return isDifferent ? merged : prev;
    });
  }

  const toggleExpansion = useCallback((modelId: string) => {
    setResponses((prev) =>
      prev.map((r) => (r.modelId === modelId ? { ...r, isExpanded: !r.isExpanded } : r))
    );
  }, []);

  return {
    responses,
    toggleExpansion,
  };
}
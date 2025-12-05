import { useState, useCallback } from "react";
import { ModelResponse } from "../types/ChatMessage";

export function useModelResponses(initialResponses: ModelResponse[]) {
    const [responses, setResponses] = useState<ModelResponse[]>(initialResponses);

    const toggleExpansion = useCallback((modelId: string) => {
        setResponses(prev => 
            prev.map(r =>
                r.modelId === modelId ? {...r, isExpanded: !r.isExpanded} : r
            )
        )
    }, []);

    const changeSubModel = useCallback((modelId: string, newSubModelId:string) => {
        setResponses(prev => 
            prev.map(r =>
                r.modelId === modelId ? {...r, subModelId: newSubModelId} : r
            )
        )
    }, [])

    return { responses, toggleExpansion, changeSubModel }
}
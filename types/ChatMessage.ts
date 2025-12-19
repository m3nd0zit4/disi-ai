export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface ModelResponse {
    modelId: string; // ID of the SpecializedModel (e.g. "gpt-4o")
    provider: string;
    category: string; // "reasoning", "image", "video"
    content: string;
    mediaUrl?: string;
    isLoading: boolean;
    error?: string;
    responseTime: number; // in seconds
    isExpanded: boolean;
    _id?: string;
    status?: "processing" | "completed" | "failed";
    sources?: {
        title: string;
        url: string;
        description?: string;
    }[];
}

export interface ConversationTurn {
    userMessage: ChatMessage;
    modelResponse: ModelResponse[];
}
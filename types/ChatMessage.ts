export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface ModelResponse {
    modelId: string; // "GPT", "CLAUDE", etc
    subModelId: string; // "gpt-3.5-turbo", "claude-3.5-sonnet", etc-
    content: string;
    isLoading: boolean;
    error?: string;
    responseTime: number; // in seconds
    isExpanded: boolean;
    _id?: string;
    status?: "processing" | "completed" | "failed";
}

export interface ConversationTurn {
    userMessage: ChatMessage;
    modelResponse: ModelResponse[];
}
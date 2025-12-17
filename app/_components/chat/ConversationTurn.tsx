'use client';

import { useModelResponses } from "@/hooks/useModelResponses";
import { ConversationTurn as ConversationTurnType } from "@/types/ChatMessage";
import { Message, MessageContent, MessageAvatar } from "@/components/ui/message";
import { ModelResponseCard } from "./ModelResponseCard"; 

interface ConversationTurnProps {
    turn: ConversationTurnType;
}


export function ConversationTurn({ turn }: ConversationTurnProps) {
    const { responses, toggleExpansion } = useModelResponses(turn.modelResponse);

    return (
        <div className="space-y-4">
            {/* User Message */}
            <Message className="justify-end">
                <MessageContent className="bg-primary text-primary-foreground">
                    {turn.userMessage.content}
                </MessageContent>
                <MessageAvatar 
                    src=""
                    alt="User"
                    fallback="U"
                />
            </Message>
            {/* Model Responses */}
            <div className="space-y-3">
                {responses.map((response) => (
                    <ModelResponseCard
                        key={response.modelId}
                        response={response}
                        onToggleExpansion={() => toggleExpansion(response.modelId)}
                    />
                ))}
            </div>
        </div>
    );
}

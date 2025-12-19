'use client';

import { useModelResponses } from "@/hooks/useModelResponses";
import { ConversationTurn as ConversationTurnType } from "@/types/ChatMessage";
import { Message, MessageContent, MessageAvatar } from "@/components/ui/message";
import { ModelResponseCard } from "./ModelResponseCard"; 

interface ConversationTurnProps {
    turn: ConversationTurnType;
}

export function ConversationTurn({ turn }: ConversationTurnProps) {
    const { responses } = useModelResponses(turn.modelResponse);

    return (
        <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
            {/* User Message */}
            <Message className="flex flex-col items-end gap-2 w-full">
                <div className="flex flex-row-reverse items-end gap-3 w-full">
                    <MessageAvatar 
                        src="https://github.com/ibelick.png"
                        alt="User"
                        className="h-6 w-6 mb-0.5"
                    />
                    <MessageContent className="bg-secondary text-primary max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2">
                        {turn.userMessage.content}
                    </MessageContent>
                </div>
            </Message>

            {/* Model Responses */}
            <div className="flex flex-col gap-6 w-full">
                {responses.map((response) => (
                    <ModelResponseCard
                        key={response.modelId}
                        response={response}
                    />
                ))}
            </div>
        </div>
    );
}

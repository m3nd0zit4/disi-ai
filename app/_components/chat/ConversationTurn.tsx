'use client';

import { useModelResponses } from "@/hooks/useModelResponses";
import { ConversationTurn as ConversationTurnType } from "@/types/ChatMessage";
import { Message, MessageContent, MessageAvatar } from "@/components/ui/message";
import { ModelResponseCard } from "./ModelResponseCard"; 
import { useUser } from "@clerk/nextjs";

interface ConversationTurnProps {
    turn: ConversationTurnType;
}

export function ConversationTurn({ turn }: ConversationTurnProps) {
    const { responses } = useModelResponses(turn.modelResponse);
    const { user } = useUser();

    // Get initials for fallback
    const initials = user?.fullName 
        ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase()
        : user?.firstName 
            ? user.firstName[0].toUpperCase()
            : 'U';

    return (
        <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
            {/* User Message */}
            <Message className="flex flex-col items-end gap-2 w-full">
                <div className="flex flex-row-reverse items-end gap-3 w-full">
                    <MessageAvatar 
                        src={user?.imageUrl || ""}
                        alt={user?.fullName || "User"}
                        fallback={initials}
                        className="h-6 w-6 mb-0.5 text-[10px]"
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

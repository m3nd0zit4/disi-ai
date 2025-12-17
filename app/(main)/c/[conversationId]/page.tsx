"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import ChatInputBox from "@/app/_components/ChatInputBox";
import { ConversationTurn } from "@/app/_components/chat/ConversationTurn";
import { useRef, useEffect } from "react";
import { ConversationTurn as ConversationTurnType, ModelResponse } from "@/types/ChatMessage";

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as Id<"conversations">;
  
  const messages = useQuery(api.conversations.getMessages, { 
    conversationId 
  });

  const conversationsEndRef = useRef<HTMLDivElement>(null);
  

  // Transformar datos de Convex al formato de UI
  const conversationTurns: ConversationTurnType[] = (messages || []).map((msg) => {
    const modelResponses: ModelResponse[] = msg.modelResponses?.map((resp) => ({
      modelId: resp.modelId,
      provider: resp.provider,
      category: resp.category,
      content: resp.content,
      mediaUrl: resp.mediaUrl,
      isLoading: resp.status === "pending" || resp.status === "processing",
      isExpanded: resp.isExpanded ?? true,
      responseTime: resp.responseTime || 0,
      error: resp.error,
      status: resp.status,
    })) || [];

    return {
      userMessage: {
        id: msg._id,
        role: "user",
        content: msg.content,
        timestamp: new Date(msg.createdAt),
      },
      modelResponse: modelResponses,
    };
  });

  useEffect(() => {
    if (conversationTurns.length > 0) {
      conversationsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversationTurns.length, messages]);

  if (messages === undefined) {
    return <div className="flex items-center justify-center h-full">Cargando...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex-1 overflow-y-auto px-4">
        <div className="space-y-8 max-w-5xl mx-auto pt-6 pb-20">
          {conversationTurns.map((turn) => (
            <ConversationTurn key={turn.userMessage.id} turn={turn} />
          ))}
          <div ref={conversationsEndRef} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-background px-4 py-4 z-10">
        <div className="max-w-5xl mx-auto">
          <ChatInputBox conversationId={conversationId} />
        </div>
      </div>
    </div>
  );
}

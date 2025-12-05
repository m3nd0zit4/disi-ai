'use client';

import ChatInputBox from './_components/ChatInputBox'
import { useState } from 'react';
import { ConversationTurn } from './_components/chat/ConversationTurn';
import { ConversationTurn as ConversationTurnType } from '@/types/ChatMessage';

const Page = () => {
  const [conversations, setConversations] = useState<ConversationTurnType[]>([]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] ">
      {/* Messages Area Scrollable */}
      <div className='flex overflow-y-auto px-4 py-6 space-y-8'>
        {conversations.length === 0 ? (
          <div className='flex items-center justify-center h-full'>
            <p className='text-muted-foreground'>Start a conversation...</p>
          </div>
        ) : (
          conversations.map((turn) => (
            <ConversationTurn key={turn.userMessage.id} turn={turn} />
          ))
        ) 
        }
      </div>
      <ChatInputBox />
    </div>
  )
}

export default Page


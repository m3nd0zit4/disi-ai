"use client";

import { useState, useEffect } from "react";
import { ChevronDown, MessageSquare, Pin, Archive, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { SPECIALIZED_MODELS } from "@/shared/AiModelList";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Chat {
  _id: string;
  title: string;
  models: Array<{ modelId: string; provider: string; category: string; providerModelId: string }>;
  isPinned?: boolean;
  lastMessage?: {
    content: string;
    createdAt: number;
  } | null;
  updatedAt: number;
}

interface ChatListProps {
  conversations: Chat[];
  onSelectChat: (chatId: string) => void;
  onPinChat: (chatId: string) => void;
  onArchiveChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  selectedChatId?: string;
}

export function ChatList({
  conversations,
  onSelectChat,
  onPinChat,
  onArchiveChat,
  onDeleteChat,
  selectedChatId,
}: ChatListProps) {
  // Agrupar conversaciones por proveedor (Provider)
  const groupedChats = conversations.reduce((acc, chat) => {
    const mainProvider = chat.models[0]?.provider || "Other";
    if (!acc[mainProvider]) {
      acc[mainProvider] = [];
    }
    acc[mainProvider].push(chat);
    return acc;
  }, {} as Record<string, Chat[]>);

  // Separar chats pinneados
  const pinnedChats = conversations.filter((c) => c.isPinned);

  return (
    <div className="space-y-1">
      {/* Chats Pinneados */}
      {pinnedChats.length > 0 && (
        <ChatGroup
          title="Pinned"
          icon={<Pin className="w-3.5 h-3.5" />}
          chats={pinnedChats}
          defaultOpen={true}
          onSelectChat={onSelectChat}
          onPinChat={onPinChat}
          onArchiveChat={onArchiveChat}
          onDeleteChat={onDeleteChat}
          selectedChatId={selectedChatId}
        />
      )}

      {/* Chats por Modelo (Provider) */}
      {Object.entries(groupedChats).map(([provider, chats]) => {
        // Find any model from this provider to get the icon
        const model = SPECIALIZED_MODELS.find((m) => m.provider === provider);
        
        return (
          <ChatGroup
            key={provider}
            title={provider}
            icon={
              model?.icon ? (
                <Image
                  src={model.icon}
                  alt={provider}
                  width={14}
                  height={14}
                  className="object-contain"
                />
              ) : (
                <MessageSquare className="w-3.5 h-3.5" />
              )
            }
            chats={chats}
            defaultOpen={false}
            onSelectChat={onSelectChat}
            onPinChat={onPinChat}
            onArchiveChat={onArchiveChat}
            onDeleteChat={onDeleteChat}
            selectedChatId={selectedChatId}
          />
        );
      })}
    </div>
  );
}

interface ChatGroupProps {
  title: string;
  icon: React.ReactNode;
  chats: Chat[];
  defaultOpen: boolean;
  onSelectChat: (chatId: string) => void;
  onPinChat: (chatId: string) => void;
  onArchiveChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  selectedChatId?: string;
}

function ChatGroup({
  title,
  icon,
  chats,
  defaultOpen,
  onSelectChat,
  onPinChat,
  onArchiveChat,
  onDeleteChat,
  selectedChatId,
}: ChatGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (chats.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {/* Header del grupo */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent/50"
      >
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform",
            !isOpen && "-rotate-90"
          )}
        />
        <div className="flex items-center gap-1.5 flex-1">
          {icon}
          <span>{title}</span>
        </div>
        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
          {chats.length}
        </span>
      </button>

      {/* Lista de chats */}
      {isOpen && (
        <div className="space-y-0.5 ml-2">
          {chats.map((chat) => (
            <ChatItem
              key={chat._id}
              chat={chat}
              isSelected={selectedChatId === chat._id}
              onSelect={() => onSelectChat(chat._id)}
              onPin={() => onPinChat(chat._id)}
              onArchive={() => onArchiveChat(chat._id)}
              onDelete={() => onDeleteChat(chat._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ChatItemProps {
  chat: Chat;
  isSelected: boolean;
  onSelect: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

const getRelativeTime = (timestamp: number, now: number) => {
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
};

function ChatItem({
  chat,
  isSelected,
  onSelect,
  onPin,
  onArchive,
  onDelete,
}: ChatItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [relativeTime, setRelativeTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = Date.now();
      setRelativeTime(getRelativeTime(chat.updatedAt || now, now));
    };
    updateTime();
    // Actualizar cada minuto
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [chat.updatedAt]);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
        isSelected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 text-foreground"
      )}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Indicador de pin */}
      {chat.isPinned && (
        <Pin className="w-3 h-3 text-primary flex-shrink-0" />
      )}

      {/* Contenido del chat */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{chat.title}</p>
        {chat.lastMessage && (
          <p className="text-[10px] text-muted-foreground truncate">
            {chat.lastMessage.content}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-muted-foreground flex-shrink-0">
        {relativeTime}
      </span>

      {/* Menú de acciones */}
      {showActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPin(); }}>
              <Pin className="w-3.5 h-3.5 mr-2" />
              {chat.isPinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
              <Archive className="w-3.5 h-3.5 mr-2" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
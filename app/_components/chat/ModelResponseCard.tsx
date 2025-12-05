'use client';

import { ModelResponse } from "@/types/ChatMessage";
import { ChevronUp, Clock, ChevronDown, Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message, MessageAvatar, MessageContent, MessageActions, MessageAction } from "@/components/ui/message";
import AI_MODELS from "@/shared/AiModelList";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SelectValue } from "@radix-ui/react-select";

interface ModelResponseCardProps {
    response: ModelResponse;
    onToggleExpansion: () => void;
    onChangeSubModel: (newSubModelId: string) => void;
}

export function ModelResponseCard({
    response,
    onToggleExpansion,
    onChangeSubModel
}: ModelResponseCardProps) {
    const model = AI_MODELS.find(m => m.model === response.modelId);
    const currentSubModel = model?.subModel.find(sm => sm.id === response.subModelId);

    if (!model || !currentSubModel) return null;

    return (
        <div className={cn(
            "border rounded-lg transition-all duration-200",
            response.isExpanded ? "border-card" : "border-muted/30"
        )}>
        <div className="flex items-center justify-between p-4 cursor-pointer " onClick={onToggleExpansion}>
            <div className="flex items-center gap-3 flex-1">
                {/* Model Avatar */}
                <MessageAvatar
                    src={model.icon}
                    alt={model.model} 
                    fallback={model.model[0]}
                    className="w-8 h-8"
                />
                {/* Change Submodel */}
                <Select 
                    value={response.subModelId}
                    onValueChange={onChangeSubModel}
                >
                    <SelectTrigger
                        className="w-[180px] h-8"
                        onClick={(e) => e.stopPropagation()} // prevent toggle expansion
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {model.subModel.map(sm => (
                            <SelectItem key={sm.id} value={sm.id}>
                                {sm.name} {sm.premium && "⭐"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* State and Time */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {response.isLoading ? (
                        <span className="flex items-center gap-1">
                            <span className="animate-pulse"></span> Generating...
                        </span>
                    ) : response.error ?(

                        <span className="text-destructive"> Error </span>

                    ) : (
                        <>
                            <span>Response ready</span>
                            {response.responseTime && (
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {response.responseTime}
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>   

            {/* Expand or Collapse Button */}
            <Button>
                {response.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
        </div>

        {/* Expand Content */}
        {response.isExpanded && (
            <div className="px-4 pb-4 space-y-3">
                {/* Message Using Markdown */}
                <MessageContent markdown className="prose-sm max-w-none">
                    {response.content}
                </MessageContent>

                {/* Actions */}
                <MessageActions className="pt-2 border-t">
                    <MessageAction tooltip="Copiar">
                        <Button>
                            <Copy className="w-4 h-4" />
                        </Button>
                    </MessageAction>
                    <MessageAction tooltip="Like">
                        <Button>
                            <ThumbsUp className="w-4 h-4" />
                        </Button>
                    </MessageAction>
                    <MessageAction tooltip="Dislike">
                        <Button>
                            <ThumbsDown className="w-4 h-4" />
                        </Button>
                    </MessageAction>
                </MessageActions>
            </div>
        )}
    </div>
    )
    
}
'use client';

import ChatInputBox from './_components/ChatInputBox';
import { useState, useRef, useEffect } from 'react';
import { ConversationTurn } from './_components/chat/ConversationTurn';
import { ModelResponseCard } from './_components/chat/ModelResponseCard';
import { ConversationTurn as ConversationTurnType, ModelResponse } from '@/types/ChatMessage';
import { useAIContext } from '@/context/AIContext';
import { Sparkles } from 'lucide-react';

const Page = () => {
  const [conversations, setConversations] = useState<ConversationTurnType[]>([]);
  const { selectedModels, hasModelsSelected } = useAIContext();
  const conversationsEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = (prompt: string) => {
    if (!prompt.trim() || selectedModels.length === 0) return;

    // Crear respuestas para cada modelo seleccionado
    const modelResponses: ModelResponse[] = selectedModels.map((model, index) => ({
      modelId: model.modelId,
      subModelId: model.subModelId,
      content: '',
      isLoading: true,
      isExpanded: index < 2, // Primeras 2 expandidas
      responseTime: 0, // Will be updated when response arrives
      error: undefined,
    }));

    // Crear nuevo turno de conversación
    const newTurn: ConversationTurnType = {
      userMessage: {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      },
      modelResponse: modelResponses,
    };

    setConversations((prev) => [...prev, newTurn]);

    // Simular respuestas (temporal)
    setTimeout(() => {
      simulateResponses(newTurn.userMessage.id);
    }, 1000);
  };

  const simulateResponses = (messageId: string) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.userMessage.id !== messageId) return conv;

        return {
          ...conv,
          modelResponse: conv.modelResponse.map((response) => ({
            ...response,
            content: `Esta es una respuesta simulada de **${response.modelId}** usando el modelo **${response.subModelId}**.\n\nTu pregunta fue: "${conv.userMessage.content}"\n\n### Ejemplo de código\n\`\`\`javascript\nconst respuesta = "${response.modelId} respondiendo...";\nconsole.log(respuesta);\n\`\`\`\n\nEsta es solo una simulación hasta que conectemos las APIs reales.`,
            isLoading: false,
            responseTime: Math.random() * 3 + 1,
          })),
        };
      })
    );
  };

  useEffect(() => {
    conversationsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, selectedModels]);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex-1 overflow-y-auto px-4">
        {conversations.length === 0 && !hasModelsSelected ? (

          // ESTADO 1: Sin modelos seleccionados (Añadido pt-6)
          <div className="flex flex-col items-center justify-center h-full text-center space-y-7 pt-6">
            <div>
              <h2 className="logo-font">Bienvenido a DISI</h2> 
              <p className="text-muted-foreground">
                Selecciona uno o más modelos de IA en el dock superior para comenzar
              </p>
            </div>
          </div>
        ) : conversations.length === 0 && hasModelsSelected ? (

          // ESTADO 2: Modelos seleccionados pero sin conversación (Añadido py-6)
          <div className="max-w-3xl mx-auto space-y-6 py-6">
            <div className="text-center space-y-2 mb-8">
              <div className="inline-flex items-center gap-2 text-primary">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Modelos listos para responder</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Puedes cambiar el sub-modelo de cada IA antes de enviar tu mensaje
              </p>
            </div>

            <div className="space-y-3">
              {selectedModels.map((model) => (
                <ModelResponseCard
                  key={model.modelId}
                  response={{
                    modelId: model.modelId,
                    subModelId: model.subModelId,
                    content: '',
                    isLoading: false,
                    isExpanded: true,
                  }}
                  showContent={false} // Modo Config
                />
              ))}
            </div>

            <div className="text-center text-sm text-muted-foreground pt-4">
              Escribe tu mensaje abajo para comenzar ↓
            </div>
          </div>
        ) : (

          // ESTADO 3: Conversaciones 
          <div className="space-y-8 max-w-5xl mx-auto pt-6 pb-20">
            {conversations.map((turn) => (
              <ConversationTurn key={turn.userMessage.id} turn={turn} />
            ))}
            <div ref={conversationsEndRef} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-background px-4 py-4 z-10">
        <div className="max-w-5xl mx-auto">
          <ChatInputBox onSendMessage={handleSendMessage} />
        </div>
      </div>
      
    </div>
  );
};

export default Page;
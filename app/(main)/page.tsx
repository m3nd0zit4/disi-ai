'use client';

import ChatInputBox from '@/app/_components/ChatInputBox';
import { ModelConfigCard } from '@/app/_components/chat/ModelConfigCard';
import { useAIContext } from '@/context/AIContext';
import { Sparkles } from 'lucide-react';

const Page = () => {
  const { selectedModels, hasModelsSelected } = useAIContext();

  // Only show reasoning models in the main list
  // Tools (Image/Video) are accessed via the reasoning model cards
  const reasoningModels = selectedModels.filter(m => m.category === 'reasoning');

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex-1 overflow-y-auto px-4">
        {!hasModelsSelected ? (
          // ESTADO 1: Sin modelos seleccionados
          <div className="flex flex-col items-center justify-center h-full text-center space-y-7 pt-6">
            <div>
              <h2 className="logo-font">Bienvenido a DISI</h2>
              <p className="text-muted-foreground">
                Selecciona uno o más modelos de IA en el dock superior para comenzar
              </p>
            </div>
          </div>
        ) : (
          // ESTADO 2: Modelos seleccionados pero sin conversación
          <div className="max-w-3xl mx-auto space-y-6 py-6">
            <div className="text-center space-y-2 mb-8">
              <div className="inline-flex items-center gap-2 text-primary">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Modelos listos para responder</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Configura las capacidades de cada modelo antes de enviar tu mensaje
              </p>
            </div>

            <div className="space-y-3">
              {reasoningModels.map((model, index) => (
                <ModelConfigCard
                  key={`${model.modelId}-${index}`}
                  response={{
                    modelId: model.modelId,
                    provider: model.provider,
                    category: model.category,
                    content: '',
                    isLoading: false,
                    isExpanded: true,
                    responseTime: 0,
                  }}
                  modelIndex={selectedModels.findIndex((m, i) =>
                    m.modelId === model.modelId &&
                    selectedModels.slice(0, i).filter(sm => sm.modelId === model.modelId).length ===
                    reasoningModels.slice(0, index).filter(rm => rm.modelId === model.modelId).length
                  )}
                  isEnabled={model.isEnabled}
                />
              ))}
              {reasoningModels.length === 0 && selectedModels.length > 0 && (
                  <div className="text-center text-muted-foreground">
                      Selecciona un modelo de razonamiento (Orquestador) para comenzar.
                  </div>
              )}
            </div>

            <div className="text-center text-sm text-muted-foreground pt-4">
              Escribe tu mensaje abajo para comenzar ↓
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-background px-4 py-4 z-10">
        <div className="max-w-5xl mx-auto">
          <ChatInputBox />
        </div>
      </div>
      
    </div>
  );
};

export default Page;

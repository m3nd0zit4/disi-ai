'use client';

import React from 'react';
import ChatInputBox from '@/app/_components/ChatInputBox';
import { useAIContext } from '@/context/AIContext';
import { Sparkles } from 'lucide-react';

const Page = () => {
  const { hasModelsSelected } = useAIContext();

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
          <div className="flex flex-col items-center justify-center h-full text-center space-y-7 pt-6">
            <div className="max-w-md mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 text-primary">
                <Sparkles className="w-6 h-6" />
                <h3 className="text-xl font-semibold">Modelos listos para responder</h3>
              </div>
              <p className="text-muted-foreground">
                Puedes personalizar cada modelo añadiendo capacidades de imagen o video directamente en el selector de abajo.
              </p>
              <div className="text-sm text-muted-foreground animate-bounce pt-8">
                Escribe tu mensaje abajo para comenzar ↓
              </div>
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

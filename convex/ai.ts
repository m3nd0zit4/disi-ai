"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const generateResponse = internalAction({
  args: {
    responseId: v.id("modelResponses"),
    modelId: v.string(),
    subModelId: v.string(),
    userMessage: v.string(),
  },
  handler: async (ctx, args) => {
    // Aquí es donde llamaríamos a la API real (OpenAI, Anthropic, etc.)
    // Por ahora, simulamos una respuesta con un delay
    
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const mockResponse = `Respuesta simulada desde el backend de Convex.\n\nModelo: **${args.modelId}**\nSubmodelo: **${args.subModelId}**\n\nTu mensaje fue: "${args.userMessage}"\n\nPronto conectaremos esto con las APIs reales.`;

    // Actualizar la respuesta en la base de datos
    await ctx.runMutation(internal.messages.updateResponse, {
      responseId: args.responseId,
      content: mockResponse,
      status: "completed",
      responseTime: 1.5,
      tokens: 100,
      cost: 0.002,
    });
  },
});

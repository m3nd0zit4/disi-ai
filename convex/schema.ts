import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ===== USUARIOS =====
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro")),
    
    // Stripe
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("canceled"),
        v.literal("past_due"),
        v.literal("trialing")
      )
    ),
    subscriptionEndDate: v.optional(v.number()),
    
    // Configuración
    apiKeySource: v.union(v.literal("user"), v.literal("system")), // Por defecto "system"
    
    // Metadata
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  // ===== API KEYS DE USUARIOS (Referencia a AWS) =====
  userApiKeys: defineTable({
    userId: v.id("users"),
    modelId: v.string(), // "GPT", "Claude", "Gemini", etc.
    hasKey: v.boolean(),
    awsSecretName: v.optional(v.string()), // Nombre del secreto en AWS
    isValid: v.optional(v.boolean()), // Se valida periódicamente
    lastValidated: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_model", ["userId", "modelId"]),

  // ===== CONVERSACIONES =====
  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    
    // Modelos usados en esta conversación
    models: v.array(
      v.object({
        modelId: v.string(),
        provider: v.string(),
        category: v.string(),
        providerModelId: v.string(),
      })
    ),
    
    // Metadata
    messageCount: v.number(),
    totalTokens: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    
    // Flags
    isPinned: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
    
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_updated", ["userId", "updatedAt"])
    .index("by_user_pinned", ["userId", "isPinned"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["userId"],
    }),

  // ===== MENSAJES =====
  messages: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    
    // Contenido
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    
    // Metadata del mensaje de usuario
    hasAttachments: v.optional(v.boolean()),
    attachments: v.optional(
      v.array(
        v.object({
          type: v.string(), // "image", "file", "code"
          url: v.optional(v.string()),
          name: v.optional(v.string()),
          size: v.optional(v.number()),
        })
      )
    ),
    
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_and_created", ["conversationId", "createdAt"])
    .index("by_user", ["userId"]),

  // ===== RESPUESTAS DE MODELOS =====
  modelResponses: defineTable({
    messageId: v.id("messages"), // Mensaje del usuario al que responde
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    
    // Modelo
    modelId: v.string(),
    provider: v.string(),
    category: v.string(),
    providerModelId: v.string(),
    
    // Contenido
    content: v.string(),
    mediaUrl: v.optional(v.string()),
    
    // Estado
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("error")
    ),
    error: v.optional(v.string()),
    
    // Métricas
    responseTime: v.optional(v.number()), // segundos
    tokens: v.optional(v.number()),
    cost: v.optional(v.number()), // USD
    
    // UI State (para saber si está expandido en el frontend)
    isExpanded: v.optional(v.boolean()),
    
    // Orchestration Support
    parentResponseId: v.optional(v.id("modelResponses")), // Para respuestas orquestadas
    orchestrationData: v.optional(
      v.object({
        isOrchestrator: v.boolean(),
        orchestratedTasks: v.optional(
          v.array(
            v.object({
              taskType: v.string(), // "image", "video", "analysis"
              modelId: v.string(),
              status: v.string(),
              responseId: v.optional(v.id("modelResponses")),
            })
          )
        ),
        orchestrationPrompt: v.optional(v.string()),
      })
    ),
    
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_message", ["messageId"])
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_date", ["userId", "createdAt"])
    .index("by_parent_response", ["parentResponseId"]),

  // ===== USAGE TRACKING =====
  usageRecords: defineTable({
    userId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    modelId: v.string(),
    provider: v.string(),
    category: v.string(),
    providerModelId: v.string(),
    
    // Métricas
    tokens: v.number(),
    cost: v.number(),
    
    // Timestamps
    timestamp: v.number(),
    yearMonth: v.string(), // "2025-01" para queries eficientes
  })
    .index("by_user", ["userId"])
    .index("by_user_and_month", ["userId", "yearMonth"])
    .index("by_model", ["modelId"]),

  // ===== BILLING EVENTS =====
  billingEvents: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("subscription_created"),
      v.literal("subscription_updated"),
      v.literal("subscription_canceled"),
      v.literal("payment_succeeded"),
      v.literal("payment_failed"),
      v.literal("trial_started"),
      v.literal("trial_ended")
    ),
    
    // Stripe data
    stripeEventId: v.string(),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    
    // Metadata
    metadata: v.optional(v.any()),
    
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_stripe_event", ["stripeEventId"])
    .index("by_type", ["type"]),

  // ===== FEEDBACK =====
  feedback: defineTable({
    userId: v.id("users"),
    responseId: v.id("modelResponses"),
    conversationId: v.id("conversations"),
    
    type: v.union(
      v.literal("thumbs_up"),
      v.literal("thumbs_down")
    ),
    
    comment: v.optional(v.string()),
    
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_response", ["responseId"])
    .index("by_conversation", ["conversationId"]),
});
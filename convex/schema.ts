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

    // Knowledge Garden Settings
    gardenSettings: v.optional(v.object({
      isActive: v.boolean(),
      feedMode: v.union(
        v.literal("manual"),
        v.literal("assisted"),
        v.literal("automatic")
      ),
      defaultKbId: v.optional(v.id("knowledgeBases")),
      suggestThreshold: v.number(),  // Default 0.6
      autoThreshold: v.number(),     // Default 0.8
      duplicateThreshold: v.number(), // Default 0.95
    })),

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
        specializedModels: v.optional(v.array(v.string())), // IDs of specialized models (image/video) for this reasoning instance
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

    // Canvas Migration
    isLegacy: v.optional(v.boolean()),
    migratedToCanvasId: v.optional(v.id("canvas")),
    canvasId: v.optional(v.id("canvas")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_updated", ["userId", "updatedAt"])
    .index("by_user_pinned", ["userId", "isPinned"])
    .index("by_canvas", ["canvasId"])
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
          storageId: v.optional(v.string()), // ID de Convex Storage
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
    mediaStorageId: v.optional(v.string()), // ID de Convex Storage para media generada

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

    type: v.union(v.literal("thumbs_up"), v.literal("thumbs_down")),

    comment: v.optional(v.string()),

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_response", ["responseId"])
    .index("by_conversation", ["conversationId"]),

  // ===== CANVAS =====
  canvas: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    
    // Canvas data (React Flow)
    nodes: v.array(v.any()),
    edges: v.array(v.any()),
    
    // Metadata
    isTemplate: v.optional(v.boolean()),
    isPublic: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    
    // Stats
    executionCount: v.optional(v.number()),
    lastExecutedAt: v.optional(v.number()),

    // Pinned
    isPinned: v.optional(v.boolean()),

    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    viewport: v.optional(v.any()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_updated", ["userId", "updatedAt"])
    .index("by_user_pinned", ["userId", "isPinned"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["userId", "isPublic"],
    }),

  // ===== CANVAS EXECUTIONS =====
  canvasExecutions: defineTable({
    canvasId: v.id("canvas"),
    userId: v.id("users"),
    
    // Input inicial
    input: v.optional(v.any()),
    
    // Output final
    output: v.optional(v.any()),
    
    // Estado de ejecución
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    
    // Ejecución de cada nodo
    nodeExecutions: v.array(
      v.object({
        nodeId: v.string(),
        status: v.string(),
        input: v.optional(v.any()),
        output: v.optional(v.any()),
        error: v.optional(v.string()),
        duration: v.optional(v.number()),
      })
    ),
    
    // Métricas
    totalDuration: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_canvas", ["canvasId"])
    .index("by_user", ["userId"])
    .index("by_canvas_and_created", ["canvasId", "createdAt"]),

  // ===== WORKER QUEUE (Local Fallback for SQS) =====
  workerQueue: defineTable({
    queueUrl: v.string(),
    messageBody: v.string(), // JSON string
    messageGroupId: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_status_created", ["status", "createdAt"]),

  // ===== FILES (File Processing Architecture) =====
  files: defineTable({
    // Relaciones
    canvasId: v.optional(v.id("canvas")), // Made optional to support KB-only files
    kbId: v.optional(v.id("knowledgeBases")),
    userId: v.id("users"),

    // Metadata
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    s3Key: v.string(),

    // Estado
    status: v.union(
      v.literal("uploading"),
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),

    // Resultados (solo metadata, no contenido)
    extractedTextLength: v.optional(v.number()),
    totalChunks: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_canvas", ["canvasId"])
    .index("by_kb", ["kbId"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_s3_key", ["s3Key"]),

  // ===== KNOWLEDGE GARDEN =====

  // Knowledge Bases (Collections)
  knowledgeBases: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    smartSplitEnabled: v.optional(v.boolean()),
    
    // Stats
    fileCount: v.optional(v.number()),
    seedCount: v.optional(v.number()),
    
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"]),

  // Seeds (Atomic Knowledge Units)
  seeds: defineTable({
    kbId: v.id("knowledgeBases"),
    fileId: v.optional(v.id("files")), // Optional if created manually or from flow
    sourceFlowId: v.optional(v.id("canvas")), // If promoted from a flow

    title: v.string(),
    summary: v.optional(v.string()),
    fullText: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),

    // Chunk references (if using chunking)
    chunkIndices: v.optional(v.array(v.number())),

    // Idempotency key to prevent duplicate seeds on worker retries
    idempotencyKey: v.optional(v.string()),

    version: v.optional(v.number()),
    status: v.union(v.literal("draft"), v.literal("ready"), v.literal("archived")),

    provenance: v.optional(v.object({
      pageNumber: v.optional(v.number()),
      startChar: v.optional(v.number()),
      endChar: v.optional(v.number()),
    })),

    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_kb", ["kbId"])
    .index("by_file", ["fileId"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["kbId"],
    })
    .searchIndex("search_body", {
      searchField: "fullText",
      filterFields: ["kbId"],
    }),

  // Seed Links (Graph Edges)
  seedLinks: defineTable({
    seedA: v.id("seeds"),
    seedB: v.id("seeds"),
    relation: v.union(
      v.literal("RELATED"),
      v.literal("PART_OF"),
      v.literal("CONTRADICTS"),
      v.literal("DERIVED_FROM"),
      v.literal("USED_IN_FLOW")
    ),
    score: v.optional(v.number()), // Similarity score
    createdAt: v.number(),
  })
    .index("by_seed_a", ["seedA"])
    .index("by_seed_b", ["seedB"])
    .index("by_seed_pair", ["seedA", "seedB", "relation"]),

  // Seed Candidates (Auto-Feed Staging)
  seedCandidates: defineTable({
    userId: v.id("users"),
    kbId: v.optional(v.id("knowledgeBases")), // Target KB (null = user default)

    // Source provenance
    canvasId: v.optional(v.id("canvas")),
    nodeId: v.optional(v.string()),
    executionId: v.optional(v.id("canvasExecutions")),
    modelResponseId: v.optional(v.id("modelResponses")),

    // Content
    title: v.string(),
    content: v.string(), // The AI response text
    summary: v.optional(v.string()),

    // Evaluation
    evaluationScore: v.number(), // 0-1
    evaluationReasons: v.array(v.string()),
    evaluationMetrics: v.optional(v.object({
      wordCount: v.number(),
      sentenceCount: v.number(),
      hasStructure: v.boolean(),
      hasCodeBlocks: v.boolean(),
      informationDensity: v.number(),
    })),

    // Duplicate detection
    similarSeedId: v.optional(v.id("seeds")), // If found similar
    similarityScore: v.optional(v.number()),

    // Status workflow
    status: v.union(
      v.literal("pending"),       // Awaiting user decision (Assisted mode)
      v.literal("auto_approved"), // Auto-approved (Automatic mode)
      v.literal("accepted"),      // User accepted
      v.literal("rejected"),      // User rejected
      v.literal("converted")      // Converted to seed
    ),

    // Mode tracking
    feedMode: v.union(
      v.literal("manual"),
      v.literal("assisted"),
      v.literal("automatic")
    ),

    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
    convertedSeedId: v.optional(v.id("seeds")),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_canvas", ["canvasId"])
    .index("by_kb", ["kbId"]),

  // Node Positions (Persisted layout for Canvas promotion)
  nodePositions: defineTable({
    seedId: v.id("seeds"),
    canvasId: v.id("canvas"), // Context where this position applies
    x: v.number(),
    y: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    lastViewedAt: v.optional(v.number()),
  })
    .index("by_seed_canvas", ["seedId", "canvasId"]),
});

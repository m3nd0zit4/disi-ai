import { ReasoningContext, ReasoningContextItem, SemanticRole } from "./types";

const ROLE_PRIORITY: Record<SemanticRole, number> = {
  instruction: 100,
  constraint: 90,
  critique: 80,
  example: 70,
  knowledge: 60,
  history: 50,
  evidence: 40,
  context: 30,
};

interface DistillationOptions {
  maxTokens?: number;
  preserveRoles?: SemanticRole[];
}

/**
 * Distills the reasoning context by ranking, filtering, and potentially compressing items.
 */
export function distillContext(
  context: ReasoningContext,
  options: DistillationOptions = {}
): ReasoningContext {
  const { 
    maxTokens = 4000, 
    preserveRoles = ["instruction", "constraint"] 
  } = options;

  // 1. Estimate tokens and check if distillation is needed
  const currentTokens = estimateTokens(context.items);
  if (currentTokens <= maxTokens) {
    return { ...context, totalTokens: currentTokens, isDistilled: false };
  }

  // 2. Layer 1: Ranking
  // Sort by role priority first, then by importance (1-5)
  const rankedItems = [...context.items].sort((a, b) => {
    const priorityA = ROLE_PRIORITY[a.role] || 0;
    const priorityB = ROLE_PRIORITY[b.role] || 0;
    
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }
    
    return b.importance - a.importance;
  });

  // 3. Layer 2: Filtering & Truncating
  const distilledItems: ReasoningContextItem[] = [];
  let tokenCount = 0;

  for (const item of rankedItems) {
    const itemTokens = estimateTokens([item]);
    
    // If it's a preserved role, we try to keep it even if it exceeds budget (within reason)
    const isPreserved = preserveRoles.includes(item.role);
    
    if (tokenCount + itemTokens <= maxTokens || isPreserved) {
      distilledItems.push(item);
      tokenCount += itemTokens;
    } else {
      // Layer 3: Compression (Basic truncation for now)
      // In a real scenario, we would trigger a summarization call here
      if (item.content.length > 500) {
        const truncatedContent = item.content.substring(0, 500) + "... [truncated for context efficiency]";
        const truncatedTokens = Math.ceil(truncatedContent.length / 4);
        
        if (tokenCount + truncatedTokens <= maxTokens) {
          distilledItems.push({
            ...item,
            content: truncatedContent,
            isSummarized: true
          });
          tokenCount += truncatedTokens;
        }
      }
    }
  }

  return {
    ...context,
    items: distilledItems,
    totalTokens: tokenCount,
    isDistilled: true
  };
}

/**
 * Simple token estimation (approx 4 chars per token)
 */
export function estimateTokens(items: ReasoningContextItem[]): number {
  const totalChars = items.reduce((sum, item) => sum + item.content.length, 0);
  return Math.ceil(totalChars / 4);
}

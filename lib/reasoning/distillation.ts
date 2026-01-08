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
  preservedItemOverage?: number; // Allow preserved items to exceed budget by this amount
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
    preserveRoles = ["instruction", "constraint"],
    preservedItemOverage = 500 
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

  // 3. Layer 2: Filtering & Truncating with hard cap for preserved items
  const distilledItems: ReasoningContextItem[] = [];
  let tokenCount = 0;
  let preservedTokenCount = 0;
  const hardCap = maxTokens + preservedItemOverage;

  for (const item of rankedItems) {
    const itemTokens = estimateTokens([item]);
    
    // If it's a preserved role, we try to keep it but respect the hard cap
    const isPreserved = preserveRoles.includes(item.role);
    
    if (isPreserved) {
      // Check if adding this preserved item would exceed the hard cap
      if (tokenCount + itemTokens <= hardCap) {
        distilledItems.push(item);
        tokenCount += itemTokens;
        preservedTokenCount += itemTokens;
        
        // Warn if we're exceeding the soft limit (maxTokens) due to preserved items
        if (tokenCount > maxTokens) {
          console.warn(
            `[Distillation] Preserved item "${item.role}" caused token count (${tokenCount}) to exceed budget (${maxTokens}). ` +
            `Hard cap: ${hardCap}. Preserved tokens: ${preservedTokenCount}.`
          );
        }
      } else {
        console.warn(
          `[Distillation] Skipping preserved item "${item.role}" as it would exceed hard cap (${hardCap}). ` +
          `Current: ${tokenCount}, Item: ${itemTokens}`
        );
      }
    } else if (tokenCount + itemTokens <= maxTokens) {
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

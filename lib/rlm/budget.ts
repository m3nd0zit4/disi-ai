/**
 * RLM Budget Manager - Token and depth budget tracking
 * 
 * Ensures execution stays within limits and prevents runaway costs.
 */

export interface BudgetState {
  tokensUsed: number;
  tokenBudget: number;
  callsMade: number;
  maxCalls: number;
}

export class BudgetManager {
  private tokensUsed: number = 0;
  private tokenBudget: number;
  private callsMade: number = 0;
  private maxCalls: number;
  private summarizeThreshold: number;

  constructor(
    tokenBudget: number = 16000,
    maxCalls: number = 20,
    summarizeThreshold: number = 2000
  ) {
    this.tokenBudget = tokenBudget;
    this.maxCalls = maxCalls;
    this.summarizeThreshold = summarizeThreshold;
  }

  /**
   * Check if we can afford an estimated token cost
   */
  canAfford(estimatedTokens: number): boolean {
    return (this.tokensUsed + estimatedTokens) <= this.tokenBudget;
  }

  /**
   * Check if we can make another call
   */
  canMakeCall(): boolean {
    return this.callsMade < this.maxCalls;
  }

  /**
   * Consume tokens and increment call count
   */
  consume(actualTokens: number): void {
    this.tokensUsed += actualTokens;
    this.callsMade++;
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): { tokens: number; calls: number } {
    return {
      tokens: Math.max(0, this.tokenBudget - this.tokensUsed),
      calls: Math.max(0, this.maxCalls - this.callsMade),
    };
  }

  /**
   * Determine if a context slice should be summarized before use
   */
  shouldSummarize(sliceTokens: number): boolean {
    // Summarize if slice is large relative to remaining budget
    const remaining = this.tokenBudget - this.tokensUsed;
    return sliceTokens > this.summarizeThreshold || sliceTokens > remaining * 0.5;
  }

  /**
   * Get current budget state
   */
  getState(): BudgetState {
    return {
      tokensUsed: this.tokensUsed,
      tokenBudget: this.tokenBudget,
      callsMade: this.callsMade,
      maxCalls: this.maxCalls,
    };
  }

  /**
   * Reset the budget manager
   */
  reset(): void {
    this.tokensUsed = 0;
    this.callsMade = 0;
  }
}

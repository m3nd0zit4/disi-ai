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

  canAfford(estimatedTokens: number): boolean {
    return this.tokensUsed + estimatedTokens <= this.tokenBudget;
  }

  canMakeCall(): boolean {
    return this.callsMade < this.maxCalls;
  }

  consume(actualTokens: number): void {
    this.tokensUsed += actualTokens;
    this.callsMade++;
  }

  getRemainingBudget(): { tokens: number; calls: number } {
    return {
      tokens: Math.max(0, this.tokenBudget - this.tokensUsed),
      calls: Math.max(0, this.maxCalls - this.callsMade),
    };
  }

  shouldSummarize(sliceTokens: number): boolean {
    const remaining = this.tokenBudget - this.tokensUsed;
    return sliceTokens > this.summarizeThreshold || sliceTokens > remaining * 0.5;
  }

  getState(): BudgetState {
    return {
      tokensUsed: this.tokensUsed,
      tokenBudget: this.tokenBudget,
      callsMade: this.callsMade,
      maxCalls: this.maxCalls,
    };
  }

  reset(): void {
    this.tokensUsed = 0;
    this.callsMade = 0;
  }
}

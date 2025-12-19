/**
 * Utility to detect and handle specific AI provider errors.
 */

export const INSUFFICIENT_FUNDS_MESSAGE = "No hay fondos suficientes en la cuenta de la API key configurada. Por favor, recarga tu saldo en el panel del proveedor.";

/**
 * Detects if an error from an AI provider indicates insufficient funds or quota exceeded.
 * Supports OpenAI, Anthropic, Google, DeepSeek, and xAI.
 */
export function isInsufficientFundsError(error: unknown): boolean {
  if (!error) return false;

  let errorMessage = "";
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object') {
    errorMessage = (error as any).message || JSON.stringify(error);
  }
  
  errorMessage = errorMessage.toLowerCase();

  // Patterns for different providers
  const patterns = [
    "insufficient_quota", // OpenAI
    "exceeded your current quota", // OpenAI
    "credit balance is too low", // Anthropic
    "usage blocked due to lack of credits", // Anthropic
    "insufficient balance", // DeepSeek / Generic
    "402", // DeepSeek / Generic Payment Required
    "billing not enabled", // Google
    "quota exceeded", // Google / Generic
    "rate limit exceeded", // Sometimes related to quota in some providers
  ];

  return patterns.some(pattern => errorMessage.includes(pattern.toLowerCase()));
}

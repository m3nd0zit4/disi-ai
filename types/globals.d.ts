export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      onboardingComplete?: boolean;
      displayName?: string;
      firstUseCase?: string;
      selectedInterests?: string[];
    };
  }
}

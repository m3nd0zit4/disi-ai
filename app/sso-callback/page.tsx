import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * OAuth (Google, etc.): redirigimos siempre a /auth/complete.
 * Esa página lee publicMetadata.onboardingComplete y redirige a /onboarding o /.
 * Así no dependemos de que Clerk distinga sign-in vs sign-up.
 */
export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/auth/complete"
        signUpForceRedirectUrl="/auth/complete"
      />
    </div>
  );
}

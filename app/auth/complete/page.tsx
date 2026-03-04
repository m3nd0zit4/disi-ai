"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

/**
 * Página intermedia tras OAuth: Clerk redirige aquí (sign-in y sign-up).
 * Redirigimos según onboarding: sin completar → /onboarding, completado → /.
 * Así no dependemos de que Clerk distinga sign-in vs sign-up; usamos nuestra lógica.
 */
export default function AuthCompletePage() {
  const { user, isLoaded } = useUser();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (!isLoaded || didRedirect.current) return;
    if (user === undefined) return; // esperar a tener user (evita redirigir con sesión no hidratada)
    didRedirect.current = true;
    const completed = (user?.publicMetadata as { onboardingComplete?: boolean } | undefined)?.onboardingComplete === true;
    window.location.replace(completed ? "/" : "/onboarding");
  }, [isLoaded, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  );
}

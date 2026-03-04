/**
 * Middleware de autenticación (Clerk) y redirecciones.
 * Next.js solo ejecuta middleware desde un archivo llamado exactamente "middleware.ts"
 * (o "middleware.js") en la raíz del proyecto. Un archivo "proxy.ts" no sería usado
 * como middleware por Next.js, por eso la lógica vive aquí y no en proxy.
 */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sso-callback",
  "/auth/complete",
  "/onboarding",
  "/privacy",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
  "/api/inngest(.*)",
  "/api/health",
]);

const ONBOARDING_COOKIE = "disi_onboarding_done";

export default clerkMiddleware(
  async (auth, request) => {
    const pathname = request.nextUrl.pathname;

    // Toda la autenticación es en / (AuthPanel). Redirigir /sign-in y /sign-up a home.
    if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const { isAuthenticated, sessionClaims } = await auth();
    const hasOnboardingCookie = request.cookies.get(ONBOARDING_COOKIE)?.value === "1";
    const claims = sessionClaims as { metadata?: { onboardingComplete?: boolean }; public_metadata?: { onboardingComplete?: boolean } };
    const onboardingCompleteFromClaims =
      claims?.metadata?.onboardingComplete === true ||
      claims?.public_metadata?.onboardingComplete === true;
    const onboardingComplete = onboardingCompleteFromClaims || hasOnboardingCookie;

    // Solo primera vez: autenticado y sin onboarding completado → /onboarding
    if (
      isAuthenticated &&
      !onboardingComplete &&
      !pathname.startsWith("/onboarding")
    ) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // Si ya completó onboarding (solo JWT, no cookie) y está en /onboarding → home.
    // No usamos la cookie aquí: puede ser de otra cuenta en el mismo navegador y causaría bucle con usuarios nuevos.
    if (
      isAuthenticated &&
      onboardingCompleteFromClaims &&
      pathname.startsWith("/onboarding")
    ) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (!isPublicRoute(request)) {
      if (!isAuthenticated) {
        const url = new URL("/", request.url);
        url.searchParams.set("redirect_url", pathname);
        return NextResponse.redirect(url);
      }
      await auth.protect();
    }
  },
  { clockSkewInMs: 60000 }
);

export const config = {
  matcher: [
    "/((?!_next|_clerk|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

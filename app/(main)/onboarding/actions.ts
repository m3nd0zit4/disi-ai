"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

export type CompleteOnboardingResult =
  | { success: true }
  | { success: false; error: string };

const ONBOARDING_COOKIE_NAME = "disi_onboarding_done";

/** Pone la cookie de onboarding completado (para usuarios que ya tenían cuenta y el middleware no ve el JWT) */
export async function ensureOnboardingCookie(): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const completed = (user.publicMetadata as { onboardingComplete?: boolean } | undefined)?.onboardingComplete === true;
  if (!completed) return;
  const cookieStore = await cookies();
  cookieStore.set(ONBOARDING_COOKIE_NAME, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

export async function completeOnboarding(formData: FormData): Promise<CompleteOnboardingResult> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "No autenticado" };
  }

  const displayName = (formData.get("displayName") as string)?.trim() || undefined;
  const firstUseCase = (formData.get("firstUseCase") as string)?.trim() || undefined;
  const selectedInterestsRaw = formData.get("selectedInterests") as string | null;
  let selectedInterests: string[] | undefined;
  if (selectedInterestsRaw) {
    try {
      const parsed = JSON.parse(selectedInterestsRaw) as unknown;
      selectedInterests = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : undefined;
    } catch {
      selectedInterests = undefined;
    }
  }

  try {
    const client = await clerkClient();
    // Nombre que muestra Clerk (UserButton, perfil) = el que la persona eligió en onboarding
    await client.users.updateUser(userId, {
      ...(displayName && {
        firstName: displayName,
        lastName: "",
      }),
      publicMetadata: {
        onboardingComplete: true,
        ...(displayName && { displayName }),
        ...(firstUseCase && { firstUseCase }),
        ...(selectedInterests && selectedInterests.length > 0 && { selectedInterests }),
      },
    });
    const cookieStore = await cookies();
    cookieStore.set(ONBOARDING_COOKIE_NAME, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 año
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    return { success: true };
  } catch (err) {
    console.error("Onboarding update failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al guardar",
    };
  }
}

"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Garantiza que exista un usuario en Convex cuando hay sesión de Clerk.
 * Clerk puede crear el usuario antes de que el webhook se procese; al montar
 * este componente llamamos getOrCreateUser para evitar "User not found" en
 * queries (knowledgeBases.list, setOnboardingContext, etc.).
 */
export function EnsureConvexUser() {
  const { isSignedIn, isLoaded } = useAuth();
  const getOrCreateUser = useMutation(api.users.users.getOrCreateUser);
  const didRun = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || didRun.current) return;
    didRun.current = true;
    getOrCreateUser().catch((err) => {
      console.warn("EnsureConvexUser: getOrCreateUser failed", err);
      didRun.current = false;
    });
  }, [isLoaded, isSignedIn, getOrCreateUser]);

  return null;
}

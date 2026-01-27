"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { clerkThemeDark, clerkThemeLight } from "@/lib/clerk/clerk";
import { ReactNode } from "react";

export default function ClerkThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { resolvedTheme } = useTheme();

  return (
    <ClerkProvider
      appearance={resolvedTheme === "dark" ? clerkThemeDark : clerkThemeLight}
      allowedSkew={60}
    >
      {children}
    </ClerkProvider>
  );
}

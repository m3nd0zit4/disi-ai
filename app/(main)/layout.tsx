"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/app/_components/AppSidebar"
import AppHeader from "@/app/_components/AppHeader";
import { usePathname } from "next/navigation";
import { KnowledgeCommand } from "@/app/_components/kb/KnowledgeCommand";
import { SettingsPanel } from "@/app/_components/settings/SettingsPanel";
import { PlansPanel } from "@/app/_components/plans/PlansPanel";
import { KGSuggestionProvider } from "@/components/ui/kg-suggestion-toast";
import { AIFeaturesProvider } from "@/app/_contexts/AIFeaturesContext";
import { EnsureConvexUser } from "@/app/_components/EnsureConvexUser";
import { useAuth, useUser } from "@clerk/nextjs";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const isCanvasPage = pathname.startsWith('/canvas/');
  const isOnboardingPage = pathname.startsWith('/onboarding');
  const isRootWithoutAuth = pathname === '/' && isLoaded && !isSignedIn;
  const isRootPendingOnboarding = pathname === '/' && isSignedIn && user !== undefined && (user?.publicMetadata as { onboardingComplete?: boolean } | undefined)?.onboardingComplete !== true;

  // No mostrar shell hasta que auth esté cargado; tampoco en / cuando falte onboarding (evita flash de home)
  const showShell = isLoaded && !isRootWithoutAuth && !isOnboardingPage && !isRootPendingOnboarding;

  return (
    <AIFeaturesProvider>
      {isLoaded && isSignedIn && <EnsureConvexUser />}
      <SidebarProvider>
        {showShell && <AppSidebar />}
        <div className="w-full min-h-screen flex flex-col overflow-hidden bg-background">
          {showShell && !isCanvasPage && <AppHeader />}
          <main className="flex-1 overflow-hidden relative flex flex-col">
            <KGSuggestionProvider>
              {children}
            </KGSuggestionProvider>
          </main>
        </div>
        {showShell && (
          <>
            <KnowledgeCommand />
            <SettingsPanel />
            <PlansPanel />
          </>
        )}
      </SidebarProvider>
    </AIFeaturesProvider>
  );
}

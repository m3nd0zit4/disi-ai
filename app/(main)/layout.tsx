"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/app/_components/AppSidebar"
import AppHeader from "@/app/_components/AppHeader";
import { usePathname } from "next/navigation";
import { KnowledgeCommand } from "@/app/_components/kb/KnowledgeCommand";
import { KGSuggestionProvider } from "@/components/ui/kg-suggestion-toast";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isCanvasPage = pathname.startsWith('/canvas/');

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="w-full min-h-screen flex flex-col overflow-hidden bg-background">
        {!isCanvasPage && <AppHeader />}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <KGSuggestionProvider>
            {children}
          </KGSuggestionProvider>
        </main>
      </div>
      <KnowledgeCommand />
    </SidebarProvider>
  );
}

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/app/_components/AppSidebar"
import AppHeader from "@/app/_components/AppHeader";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="w-full">
        <AppHeader />
        {children}
      </div>
    </SidebarProvider>
  );
}

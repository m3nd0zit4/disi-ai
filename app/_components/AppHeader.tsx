"use client"

import { SidebarTrigger } from "@/components/ui/sidebar";

export default function AppHeader() {
  return (
    <div className="flex items-center shrink-0 p-1.5">
      <SidebarTrigger className="size-8 rounded-lg hover:bg-muted/50" />
    </div>
  );
}
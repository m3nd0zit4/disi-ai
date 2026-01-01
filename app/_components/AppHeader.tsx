"use client"

import { SidebarTrigger } from '@/components/ui/sidebar'
const AppHeader = () => {
  return (
    <div className="p-2 w-full shadow-sm flex items-center justify-between border-b border-primary/5 bg-background/50 backdrop-blur-md">
        <SidebarTrigger className="size-8" />
    </div>
  )
}

export default AppHeader
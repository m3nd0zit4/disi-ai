"use client"

import { SidebarTrigger } from '@/components/ui/sidebar'
import AiDock from './AiDock'

const AppHeader = () => {
  return (
    <div className="p-3 w-full shadow flex items-center justify-between">
        <SidebarTrigger />
        <div className="flex-1 flex justify-center">
          <AiDock />
        </div>
    </div>
  )
}

export default AppHeader
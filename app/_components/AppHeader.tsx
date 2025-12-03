import React from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import AiDock from './AiDock'

const AppHeader = () => {
  return (
    <div className="p-3 w-full shadow flex items-center justify-between">
        <SidebarTrigger />
        <div className="flex-1 flex justify-center">
          <AiDock />
        </div>
        <Button>
          Sign In
        </Button>
    </div>
  )
}

export default AppHeader
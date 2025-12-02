import React from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'

const AppHeader = () => {
  return (
    <div className="p-3 w-full shadow flex items-center justify-between">
        <SidebarTrigger />
        <Button>
            Sign In
        </Button>
    </div>
  )
}

export default AppHeader
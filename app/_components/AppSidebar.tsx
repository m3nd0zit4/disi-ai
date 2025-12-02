"use client"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/sidebar"
import Image from "next/image"
import { Moon, Sun, Plus } from "lucide-react"
import { useTheme } from "next-themes"

export function AppSidebar() {
    const { theme, setTheme } = useTheme();

    return (
        <Sidebar>
            <SidebarHeader>
                <div className="p-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Image src={'/logo.svg'} alt='logo' width={60} height={60} 
                                className="w-[30px] h-[30px]"
                            />
                            <h1 className="logo-font">Disi</h1>
                        </div>
                        <div>
                            { theme === 'light'? <Button variant={'ghost'} onClick={() => setTheme('dark')}> <Sun/> </Button>: <Button variant={'ghost'} onClick={() => setTheme('light')}> <Moon/> </Button>}
                        </div>
                    </div>
                    <Button className="mt-7 w-full justify-start"><Plus/> New Chat</Button>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="font-bold">Chats</SidebarGroupLabel>
                    <p className="text-sm text-muted-foreground px-3">Sign In to start chatting your journey start with Disi AI</p>
                </SidebarGroup>
            </SidebarContent>
        <SidebarFooter>
            <div className="p-3">
                <Button variant={'outline'} className="w-full justify-center">Sign In / Sign Up</Button>
            </div>
        </SidebarFooter>
        </Sidebar>
    )
}
"use client";

import {
  Search,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ChatInputBox from '@/app/_components/ChatInputBox';
import { AuthModal } from '@/app/_components/auth/AuthModal';
import { useConvexAuth } from 'convex/react';

const Page = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-4 bg-background relative overflow-hidden">
      <AuthModal isOpen={!isLoading && !isAuthenticated} />
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-3xl space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="space-y-1.5 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground/80">Hello there</h1>
          <p className="text-muted-foreground text-base font-medium">The night is still young for creativity</p>
        </div>

        <div className="relative z-10">
          <ChatInputBox />
        </div>

        <div className="flex justify-center">
          <Button variant="ghost" size="sm" className="rounded-full bg-muted/30 border border-primary/5 gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all">
            <Search className="w-3 h-3" />
            Explore agent mode cases
            <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Page;

"use client";

import { useState, useEffect, useRef } from 'react';
import {
  Search,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ChatInputBox from '@/app/_components/ChatInputBox';
import { AuthModal } from '@/app/_components/auth/AuthModal';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useRouter } from 'next/navigation';

const Page = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [userClosed, setUserClosed] = useState(false);
  const router = useRouter();
  const canvases = useQuery(api.canvas.listCanvas);

  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !isLoading && canvases && canvases.length > 0 && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push(`/canvas/${canvases[0]._id}`);
    }
  }, [isAuthenticated, isLoading, canvases, router]);

  const showAuthModal = !isLoading && !isAuthenticated && !userClosed;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-4 bg-background relative overflow-hidden">
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setUserClosed(true)} 
      />
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      {isLoading ? (
        <div className="w-full max-w-3xl space-y-8 relative z-10 animate-pulse">
          <div className="space-y-3">
            <div className="h-10 w-48 bg-muted/30 rounded-lg" />
            <div className="h-5 w-72 bg-muted/20 rounded-lg" />
          </div>
          <div className="h-32 w-full bg-muted/20 rounded-2xl" />
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default Page;

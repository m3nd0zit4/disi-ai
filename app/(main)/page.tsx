"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-4 bg-background relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-3xl space-y-8 relative z-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3" />
            Coming Soon
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground/90">
            The Future of <span className="text-primary">Multi-Model</span> Creativity
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Disi AI is evolving. Soon, you'll be able to orchestrate multiple AI models in a beautiful, infinite canvas.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            size="lg" 
            className="rounded-full px-8 h-12 text-base font-bold gap-2 shadow-xl shadow-primary/20"
            onClick={() => router.push("/canvas")}
          >
            Go to App
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="rounded-full px-8 h-12 text-base font-bold bg-background/50 backdrop-blur-md"
          >
            Learn More
          </Button>
        </div>

        <div className="pt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
          <FeatureCard 
            title="Infinite Canvas" 
            description="Organize your thoughts and AI outputs in a spatial environment."
          />
          <FeatureCard 
            title="Multi-Model" 
            description="Connect GPT, Claude, Gemini and more in a single workflow."
          />
          <FeatureCard 
            title="Real-time Sync" 
            description="Your work is saved instantly and accessible from anywhere."
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-card/30 border border-primary/5 backdrop-blur-xl space-y-2">
      <h3 className="font-bold text-foreground/80">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

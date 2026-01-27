"use client";

import { 
  Upload, 
  Zap, 
  Command,
} from "lucide-react";


export function KBWelcomeState() {
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto text-center space-y-12 animate-in fade-in zoom-in duration-500">
      <div className="space-y-4">
        <h2 className="text-3xl font-bold tracking-tight text-foreground/90">
          Welcome to Your Knowledge Garden
        </h2>
        <p className="text-sm text-muted-foreground/60 max-w-md mx-auto leading-relaxed">
          Plant your ideas, grow your knowledge. Add your content above and watch as AI transforms it into a garden of wisdom.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6 w-full">
        {[
          {
            step: "Step 1: Upload",
            desc: "Add your content above",
            icon: Upload,
            color: "text-blue-400",
            bg: "bg-blue-400/10"
          },
          {
            step: "Step 2: AI Processing",
            desc: "AI extracts knowledge seeds",
            icon: Zap,
            color: "text-emerald-400",
            bg: "bg-emerald-400/10"
          },
          {
            step: "Step 3: Smart Match",
            desc: "Seeds power your AI chats",
            icon: Command,
            color: "text-indigo-400",
            bg: "bg-indigo-400/10"
          }
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center p-6 rounded-2xl bg-primary/5 border border-primary/5 space-y-4 group hover:bg-primary/10 transition-all">
            <div className={`p-3 rounded-xl ${item.bg} ${item.color} group-hover:scale-110 transition-transform`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[13px] font-bold">{item.step}</h3>
              <p className="text-[11px] text-muted-foreground/50">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

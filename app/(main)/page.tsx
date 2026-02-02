"use client";

import { useMemo, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import Link from "next/link";
import {
  Layout,
  ImageIcon,
  PenLine,
  HelpCircle,
  Sparkles,
  Code,
  Lightbulb,
} from "lucide-react";
import ChatInputBox, { type ChatInputBoxHandle } from "@/app/_components/ChatInputBox";
import { useAIContext } from "@/context/AIContext";
import { modelRegistry } from "@/shared/ai";
import type { SelectedModel } from "@/types/AiModel";
import type { Provider } from "@/types/AiModel";
import { cn } from "@/lib/utils";

// Map registry provider (lowercase) to UI Provider (GPT, Claude, etc.)
const REGISTRY_TO_UI_PROVIDER: Record<string, Provider> = {
  openai: "GPT",
  anthropic: "Claude",
  google: "Gemini",
  xai: "Grok",
  deepseek: "DeepSeek",
};

function registryModelToSelected(m: { id: string; provider: string; providerModelId: string; primaryCapability: string }): SelectedModel {
  const category =
    m.primaryCapability === "image.generation"
      ? "image"
      : m.primaryCapability === "video.generation"
        ? "video"
        : "reasoning";
  return {
    category: category as SelectedModel["category"],
    modelId: m.id,
    provider: REGISTRY_TO_UI_PROVIDER[m.provider] ?? "GPT",
    providerModelId: m.providerModelId,
    isEnabled: true,
  };
}

const QUICK_ACTIONS = [
  {
    label: "Create an image",
    icon: ImageIcon,
    prompt: "A professional photo of ",
    capability: "image.generation" as const,
  },
  {
    label: "Write or draft",
    icon: PenLine,
    prompt: "Write a clear, concise draft for: ",
    capability: "text.reasoning" as const,
  },
  {
    label: "Explain simply",
    icon: HelpCircle,
    prompt: "Explain this in simple terms: ",
    capability: "text.reasoning" as const,
  },
  {
    label: "Quick code help",
    icon: Code,
    prompt: "Write clean code for: ",
    capability: "text.reasoning" as const,
  },
  {
    label: "Boost my day",
    icon: Sparkles,
    prompt:
      "Give me a short boost: one actionable tip, one short quote, and one small challenge for today. No preamble.",
    capability: "text.reasoning" as const,
  },
  {
    label: "Brainstorm ideas",
    icon: Lightbulb,
    prompt: "Brainstorm 5 creative ideas for: ",
    capability: "text.reasoning" as const,
  },
] as const;

type GreetingParts = {
  line1Before: string;
  timeWord: string;
  line1After: string;
  line2: string;
};

function getTimeGreeting(): GreetingParts {
  const hour = new Date().getHours();
  const day = new Date().getDay();

  if (hour >= 5 && hour < 12) {
    const options: GreetingParts[] = [
      { line1Before: "Good ", timeWord: "morning", line1After: ".", line2: "What would you like to create?" },
      { line1Before: "Rise and shine.", timeWord: "", line1After: "", line2: "What's on your mind?" },
      { line1Before: "", timeWord: "Morning", line1After: "! Ready to build?", line2: "Where do we start?" },
      { line1Before: "Hey, early bird.", timeWord: "", line1After: "", line2: "What can I help with?" },
      { line1Before: "Good ", timeWord: "morning", line1After: " — let's make it count.", line2: "What's on your mind?" },
    ];
    const subs = ["What would you like to create?", "What's on your mind?", "Where do we start?", "What can I help with?"];
    const i = (day + hour) % options.length;
    const j = (day + hour) % subs.length;
    return { ...options[i], line2: subs[j] };
  }
  if (hour >= 12 && hour < 17) {
    const options: GreetingParts[] = [
      { line1Before: "Good ", timeWord: "afternoon", line1After: ".", line2: "What would you like to do?" },
      { line1Before: "", timeWord: "Afternoon", line1After: "! How can I help?", line2: "What can I help with?" },
      { line1Before: "Hey — hope your day's going well.", timeWord: "", line1After: "", line2: "What are we working on?" },
      { line1Before: "Good ", timeWord: "afternoon", line1After: ". What's next?", line2: "What can I help with?" },
      { line1Before: "Ready when you are.", timeWord: "", line1After: "", line2: "What would you like to do?" },
    ];
    const subs = ["What would you like to do?", "What can I help with?", "What are we working on?"];
    const i = (day + hour) % options.length;
    const j = (day + hour) % subs.length;
    return { ...options[i], line2: subs[j] };
  }
  if (hour >= 17 && hour < 21) {
    const options: GreetingParts[] = [
      { line1Before: "Good ", timeWord: "evening", line1After: ".", line2: "What would you like to create?" },
      { line1Before: "", timeWord: "Evening", line1After: " — still in the zone?", line2: "What can I help with?" },
      { line1Before: "Hey, ", timeWord: "evening", line1After: ".", line2: "Where do we start?" },
      { line1Before: "Good ", timeWord: "evening", line1After: ". What's the plan?", line2: "What can I help with?" },
    ];
    const subs = ["What would you like to create?", "What can I help with?", "Where do we start?"];
    const i = (day + hour) % options.length;
    const j = (day + hour) % subs.length;
    return { ...options[i], line2: subs[j] };
  }
  const options: GreetingParts[] = [
    { line1Before: "Burning the ", timeWord: "midnight", line1After: " oil?", line2: "What would you like to do?" },
    { line1Before: "Late ", timeWord: "night", line1After: " session — I'm here.", line2: "What's on your mind?" },
    { line1Before: "Good ", timeWord: "night", line1After: " (or good late night).", line2: "What can I help with?" },
    { line1Before: "Still up? What can I help with?", timeWord: "", line1After: "", line2: "What would you like to do?" },
  ];
  const subs = ["What would you like to do?", "What's on your mind?", "What can I help with?"];
  const i = (day + hour) % options.length;
  const j = (day + hour) % subs.length;
  return { ...options[i], line2: subs[j] };
}

export default function HomePage() {
  const { user } = useUser();
  const canvases = useQuery(api.canvas.canvas.listCanvas);
  const greeting = useMemo(() => getTimeGreeting(), []);
  const inputRef = useRef<ChatInputBoxHandle>(null);
  const { setModelsFromConversation } = useAIContext();

  const firstName = user?.firstName ?? null;
  const recentCanvases = (canvases ?? []).slice(0, 5);

  const handleQuickAction = (action: (typeof QUICK_ACTIONS)[number]) => {
    const models = modelRegistry.getByCapability(action.capability);
    const model = models[0];
    if (model) {
      setModelsFromConversation([
        registryModelToSelected({
          id: model.id,
          provider: model.provider,
          providerModelId: model.providerModelId,
          primaryCapability: model.primaryCapability,
        }),
      ]);
    }
    inputRef.current?.setPrompt(action.prompt);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full overflow-auto">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 min-h-[calc(100vh-3.5rem)]">
        <div className="w-full max-w-2xl flex flex-col items-center gap-8">
          {/* Contextual welcome — special font for day/afternoon/evening/night */}
          <div className="text-center space-y-1 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground/90 tracking-tight">
              {greeting.line1Before}
              {greeting.timeWord ? (
                <span className="logo-font text-2xl sm:text-3xl text-primary">
                  {greeting.timeWord}
                </span>
              ) : null}
              {greeting.line1After}
              {firstName ? ` ${firstName}.` : ""}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {greeting.line2}
            </p>
          </div>

          {/* Main input */}
          <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
            <ChatInputBox ref={inputRef} />
          </div>

          {/* Quick actions: set prompt + switch model when useful */}
          <div className="w-full max-w-2xl space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 text-center">
              Try something
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    handleQuickAction(
                      QUICK_ACTIONS.find((a) => a.label === label)!
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium",
                    "bg-muted/40 hover:bg-muted/80 border border-border/50 hover:border-primary/10",
                    "text-muted-foreground hover:text-foreground transition-colors"
                  )}
                >
                  <Icon className="size-3.5 shrink-0 opacity-70" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Recent history */}
          {recentCanvases.length > 0 && (
            <div className="w-full max-w-2xl pt-4 border-t border-border/50 animate-in fade-in duration-500 delay-200">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
                Recent
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {recentCanvases.map((canvas: Doc<"canvas">) => (
                  <Link
                    key={canvas._id}
                    href={`/canvas/${canvas._id}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px]",
                      "bg-muted/40 hover:bg-muted/70 border border-transparent hover:border-primary/10",
                      "text-muted-foreground hover:text-foreground transition-colors"
                    )}
                  >
                    <Layout className="size-3.5 shrink-0 opacity-60" />
                    <span className="truncate max-w-[140px]">{canvas.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

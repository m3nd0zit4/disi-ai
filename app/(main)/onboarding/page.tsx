"use client";

import { useState, useRef, useEffect } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { completeOnboarding, ensureOnboardingCookie } from "./actions";
import { logoFont } from "@/app/fonts";
import { StreamingText } from "@/app/_components/onboarding/StreamingText";
import { GripIcon, type GripIconHandle } from "@/components/ui/grip-icon";
import {
  MessageCircleQuestion,
  Lock,
  ThumbsUp,
  Code2,
  GraduationCap,
  PenLine,
  Briefcase,
  Palette,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

const INTEREST_OPTIONS = [
  { value: "programming", label: "Programación y desarrollo", icon: Code2 },
  { value: "learning", label: "Aprendizaje", icon: GraduationCap },
  { value: "writing", label: "Escritura", icon: PenLine },
  { value: "business", label: "Negocios y estrategia", icon: Briefcase },
  { value: "design", label: "Diseño", icon: Palette },
  { value: "everyday", label: "Temas del día a día", icon: ShoppingBag },
  { value: "explore", label: "Explorar con DISI", icon: Sparkles },
];

const KNOW_SECTIONS = [
  {
    icon: MessageCircleQuestion,
    title: "¿Tienes curiosidad? Solo pregunta",
    description:
      "Conversa conmigo sobre cualquier tema, desde consultas simples hasta ideas complejas. Las protecciones mantienen nuestra conversación segura.",
  },
  {
    icon: Lock,
    title: "Chats sin anuncios",
    description:
      "No te mostraré anuncios. Mi enfoque es ser genuinamente útil para ti.",
  },
  {
    icon: ThumbsUp,
    title: "Puedes mejorar DISI para todos",
    description:
      "Tu feedback nos ayuda a mejorar. Puedes cambiar preferencias en cualquier momento en tu configuración.",
  },
];

/** Logo animado: GripIcon como “pensando”; se anima mientras isStreaming */
function OnboardingLogo({ isThinking }: { isThinking?: boolean }) {
  const gripRef = useRef<GripIconHandle>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isThinking) {
      gripRef.current?.startAnimation();
      intervalRef.current = setInterval(() => {
        gripRef.current?.startAnimation();
      }, 1400);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      gripRef.current?.stopAnimation();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isThinking]);

  return (
    <GripIcon
      ref={gripRef}
      size={40}
      className="text-primary shrink-0"
      aria-hidden
    />
  );
}

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const setOnboardingContext = useMutation(api.users.users.setOnboardingContext);
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(true);
  /** Step 0: 0 = primera línea, 1 = segunda línea, 2 = ambas listas (form visible). */
  const [step0Block, setStep0Block] = useState(0);
  /** Step 1: índice del bloque actual (0=saludo, 1=subtítulo, 2=intro, 3–4=card0, 5–6=card1, 7–8=card2). Solo ese bloque hace streaming; los anteriores ya están fijos. */
  const [step1Block, setStep1Block] = useState(0);

  // Sin sesión tras cargar → ir a login (damos un poco de tiempo por si la cookie llega justo después del redirect)
  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    const t = setTimeout(() => {
      window.location.replace("/");
    }, 1500);
    return () => clearTimeout(t);
  }, [isLoaded, isSignedIn]);

  // Usuario que ya completó onboarding (ej. ya tenía cuenta) → poner cookie y a home
  useEffect(() => {
    if (!isLoaded || !user) return;
    const completed = (user.publicMetadata as { onboardingComplete?: boolean } | undefined)?.onboardingComplete === true;
    if (completed) {
      ensureOnboardingCookie().then(() => {
        window.location.replace("/");
      });
    }
  }, [isLoaded, user]);

  const canAdvanceFromName = displayName.trim().length > 0;
  const canAdvanceFromInterests = selectedInterests.length === 3;

  const handleSubmitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (canAdvanceFromName) {
      setIsStreaming(true);
      setStep(1);
    }
  };

  const handleUnderstand = () => {
    setIsStreaming(true);
    setStep(2);
  };

  // Reset streaming state al cambiar de step
  useEffect(() => {
    if (step === 0) setStep0Block(0);
    if (step === 1) setStep1Block(0);
  }, [step]);

  const toggleInterest = (value: string) => {
    setSelectedInterests((prev) =>
      prev.includes(value)
        ? prev.filter((x) => x !== value)
        : prev.length < 3
          ? [...prev, value]
          : prev
    );
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdvanceFromInterests || loading) return;
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("displayName", displayName.trim());
      formData.set("selectedInterests", JSON.stringify(selectedInterests));

      const result = await completeOnboarding(formData);

      if (result.success) {
        await setOnboardingContext({
          displayName: displayName.trim() || undefined,
          selectedInterests: selectedInterests.length > 0 ? selectedInterests : undefined,
        });
        await user?.reload();
        // Forzar token nuevo con onboardingComplete para que el middleware no redirija otra vez a /onboarding
        await getToken({ skipCache: true });
        window.location.assign("/");
        return;
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setLoading(false);
    }
  };

  const nameToShow = displayName.trim() || "tú";

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12 text-foreground ${logoFont.variable}`}>
      <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-10">
        <OnboardingLogo isThinking={isStreaming} />

        {/* Step 0: Name — streaming secuencial y layout más claro */}
        {step === 0 && (
          <div className="flex flex-col items-center gap-10 w-full">
            <div className="text-center space-y-4 w-full max-w-md">
              <h1 className={`${logoFont.className} text-2xl sm:text-3xl text-foreground tracking-tight min-h-[2.5rem]`}>
                {step0Block >= 1 ? (
                  "Creemos tu cuenta"
                ) : (
                  <StreamingText
                    text="Creemos tu cuenta"
                    speed={32}
                    delay={300}
                    onComplete={() => setStep0Block(1)}
                  />
                )}
              </h1>
              {step0Block >= 1 && (
                <p className="text-muted-foreground text-lg sm:text-xl min-h-[2rem]">
                  {step0Block >= 2 ? (
                    "Antes de empezar, ¿cómo quieres que te llame?"
                  ) : (
                    <StreamingText
                      text="Antes de empezar, ¿cómo quieres que te llame?"
                      speed={28}
                      delay={0}
                      onComplete={() => {
                        setStep0Block(2);
                        setIsStreaming(false);
                      }}
                    />
                  )}
                </p>
              )}
            </div>

            {step0Block >= 2 && (
              <form
                onSubmit={handleSubmitName}
                className="w-full max-w-md flex gap-2 animate-in fade-in slide-in-from-bottom-3 duration-400"
              >
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tu nombre"
                  className="flex-1 h-12 px-4 rounded-2xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-shadow"
                  autoComplete="name"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!canAdvanceFromName}
                  className="h-12 w-12 shrink-0 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Continuar"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Step 1: Things to know — streaming estricto de arriba a abajo: un bloque solo empieza cuando el anterior termina */}
        {step === 1 && (
          <div className="flex flex-col items-center gap-10 w-full">
            <div className="text-center space-y-3">
              <h1 className={`${logoFont.className} text-3xl sm:text-4xl text-foreground tracking-tight min-h-[2.25rem]`}>
                {step1Block >= 1 ? (
                  "Hola, soy Disi"
                ) : (
                  <StreamingText
                    text="Hola, soy Disi"
                    speed={42}
                    delay={200}
                    onComplete={() => setStep1Block(1)}
                  />
                )}
              </h1>
              {step1Block >= 1 && (
                <p className="text-muted-foreground text-base max-w-md mx-auto min-h-[2.5rem]">
                  {step1Block >= 2 ? (
                    "Soy tu asistente de IA para crear, imaginar y pensar en grande."
                  ) : (
                    <StreamingText
                      text="Soy tu asistente de IA para crear, imaginar y pensar en grande."
                      speed={28}
                      delay={0}
                      onComplete={() => setStep1Block(2)}
                    />
                  )}
                </p>
              )}
              {step1Block >= 2 && (
                <p className="text-muted-foreground/80 text-sm pt-2 min-h-[2.5rem]">
                  {step1Block >= 3 ? (
                    "Aquí hay algunas cosas que deberías saber sobre mí:"
                  ) : (
                    <StreamingText
                      text="Aquí hay algunas cosas que deberías saber sobre mí:"
                      speed={26}
                      delay={0}
                      onComplete={() => setStep1Block(3)}
                    />
                  )}
                </p>
              )}
            </div>

            <div className="space-y-6 w-full max-w-md">
              {KNOW_SECTIONS.map(({ icon: Icon, title, description }, index) => {
                const titleBlock = 3 + index * 2;
                const descBlock = 4 + index * 2;
                const isCardRevealed = step1Block > descBlock;
                const isCardCurrent = step1Block === titleBlock || step1Block === descBlock;
                if (step1Block < titleBlock) return null;

                return (
                  <div
                    key={title}
                    className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-muted flex items-center justify-center animate-in fade-in zoom-in-95 duration-300">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-foreground mb-1 min-h-[1.5rem]">
                        {isCardRevealed || step1Block === descBlock ? (
                          title
                        ) : (
                          <StreamingText
                            text={title}
                            speed={24}
                            delay={0}
                            onComplete={() => setStep1Block(descBlock)}
                          />
                        )}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed min-h-[2.5rem]">
                        {isCardRevealed ? (
                          description
                        ) : step1Block === descBlock ? (
                          <StreamingText
                            text={description}
                            speed={22}
                            delay={0}
                            onComplete={() => {
                              if (index === KNOW_SECTIONS.length - 1) {
                                setIsStreaming(false);
                              }
                              setStep1Block(descBlock + 1);
                            }}
                          />
                        ) : null}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleUnderstand}
              className="h-12 px-8 rounded-2xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Entiendo
            </button>
          </div>
        )}

        {/* Step 2: Interests */}
        {step === 2 && (
          <div className="flex flex-col items-center gap-8 w-full">
            <p className={`${logoFont.className} text-xl sm:text-2xl text-foreground text-center min-h-[3rem] font-medium`}>
              <StreamingText
                text={`¿Qué te interesa, ${nameToShow}? Elige tres temas para explorar.`}
                speed={32}
                delay={200}
                onComplete={() => setIsStreaming(false)}
              />
            </p>

            <div className="flex flex-wrap justify-center gap-3 w-full max-w-lg">
              {INTEREST_OPTIONS.map(({ value, label, icon: Icon }) => {
                const selected = selectedInterests.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleInterest(value)}
                    className={`
                      inline-flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-medium transition-colors
                      ${selected
                        ? "bg-primary/10 border-primary/50 text-foreground"
                        : "bg-muted border-border text-muted-foreground hover:border-border hover:bg-accent"
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                );
              })}
            </div>

            {selectedInterests.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedInterests.length} de 3 seleccionados
              </p>
            )}

            <form onSubmit={handleFinish} className="w-full flex flex-col items-center gap-4">
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={!canAdvanceFromInterests || loading}
                className="h-12 px-8 rounded-2xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Guardando…" : "Comencemos"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

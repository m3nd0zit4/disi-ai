"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCheck, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRO_MONTHLY_PRICE_USD,
  PRO_MONTHLY_CREDITS,
  STARTER_WELCOME_CREDITS,
} from "@/lib/plans";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { usePlansPanel } from "@/hooks/usePlansPanel";
import { motion, AnimatePresence } from "motion/react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

const stripePublishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").trim();
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type PlanId = "starter" | "payg" | "pro";

const PricingSwitch = ({
  selected,
  onSwitch,
  className,
}: {
  selected: string;
  onSwitch: (value: string) => void;
  className?: string;
}) => (
  <div className={cn("flex justify-center", className)}>
    <div className="relative z-10 mx-auto flex w-fit rounded-lg border border-border bg-muted/40 p-0.5">
      <button
        type="button"
        onClick={() => onSwitch("0")}
        className={cn(
          "relative z-10 h-9 w-fit cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
          selected === "0"
            ? "text-white"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {selected === "0" && (
          <motion.span
            layoutId="pricing-switch"
            className="absolute inset-0 rounded-md border-2 border-orange-500 bg-gradient-to-t from-orange-600 via-orange-400 to-orange-500 shadow-sm shadow-orange-600/20"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative">Monthly</span>
      </button>
      <button
        type="button"
        onClick={() => onSwitch("1")}
        className={cn(
          "relative z-10 flex h-9 w-fit flex-shrink-0 items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
          selected === "1"
            ? "text-white"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {selected === "1" && (
          <motion.span
            layoutId="pricing-switch"
            className="absolute inset-0 rounded-md border-2 border-orange-500 bg-gradient-to-t from-orange-600 via-orange-400 to-orange-500 shadow-sm shadow-orange-600/20"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative flex items-center gap-1.5">
          Yearly
          <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/50 dark:text-orange-200">
            Save 20%
          </span>
        </span>
      </button>
    </div>
  </div>
);

export function PlansPanel() {
  const { open, setOpen } = usePlansPanel();
  const user = useQuery(api.users.users.getCurrentUser);
  const currentPlan = user?.plan ?? "starter";
  const [isYearly, setIsYearly] = useState(false);
  const [billingSelected, setBillingSelected] = useState("0");
  const [proCheckoutClientSecret, setProCheckoutClientSecret] = useState<string | null>(null);
  const [proCheckoutLoading, setProCheckoutLoading] = useState(false);
  const [proCheckoutError, setProCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "STRIPE_EMBEDDED_SUCCESS") {
        setProCheckoutClientSecret(null);
        setProCheckoutError(null);
        setOpen(false);
        window.location.href = "/?pro=success";
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [setOpen]);

  const plans: Array<{
    id: PlanId;
    name: string;
    description: string;
    price: number;
    yearlyPrice: number;
    buttonText: string;
    popular: boolean;
    includes: string[];
    cta: string;
    href: string;
    action?: "pro-checkout";
  }> = [
    {
      id: "starter",
      name: "Starter",
      description: "For getting started with Canvas and AI models.",
      price: 0,
      yearlyPrice: 0,
      buttonText: "Get started",
      popular: false,
      includes: [
        "Free includes:",
        "Canvas and workflows",
        "Standard models (with your API key)",
        `${STARTER_WELCOME_CREDITS} welcome credits`,
        "Buy credits to unlock Pay As You Go",
      ],
      cta: currentPlan === "starter" || currentPlan === "free" ? "Current plan" : "Get started",
      href: "/",
    },
    {
      id: "payg",
      name: "Pay As You Go",
      description: "Buy credits when you need them. No subscription.",
      price: -1,
      yearlyPrice: -1,
      buttonText: "Buy credits",
      popular: false,
      includes: [
        "Pay As You Go includes:",
        "Canvas and workflows",
        "All models (system or your keys)",
        "Buy credits in packs",
        "No monthly commitment",
      ],
      cta: currentPlan === "payg" ? "Current plan" : "Buy credits",
      href: "/usage?action=purchase-credits",
    },
    {
      id: "pro",
      name: "Pro",
      description: "Knowledge Garden and monthly credits included.",
      price: PRO_MONTHLY_PRICE_USD,
      yearlyPrice: Math.round(PRO_MONTHLY_PRICE_USD * 12 * 0.8),
      buttonText: "Subscribe to Pro",
      popular: true,
      includes: [
        "Everything in Pay As You Go, plus:",
        "Knowledge Garden (RAG, seeds, KB)",
        `${PRO_MONTHLY_CREDITS.toLocaleString()} credits included monthly`,
        "Buy extra credits when needed",
      ],
      cta: currentPlan === "pro" ? "Current plan" : "Subscribe to Pro",
      href: "/api/stripe/create-pro-subscription",
      action: "pro-checkout",
    },
  ];

  const handleProCheckout = async () => {
    if (currentPlan === "pro") return;
    if (!stripePromise) {
      setProCheckoutError("Stripe no configurado. Añade NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.");
      return;
    }
    setProCheckoutError(null);
    setProCheckoutClientSecret(null);
    setProCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/create-pro-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearly: isYearly, embedded: true }),
      });
      const data = await res.json();
      if (data?.data?.clientSecret) {
        setProCheckoutClientSecret(data.data.clientSecret);
      } else {
        setProCheckoutError(data?.error ?? "No se pudo iniciar el checkout");
      }
    } catch {
      setProCheckoutError("Error de red");
    } finally {
      setProCheckoutLoading(false);
    }
  };

  const showProCheckout = Boolean(proCheckoutClientSecret && stripePromise);

  const closeProCheckout = () => {
    setProCheckoutClientSecret(null);
    setProCheckoutError(null);
  };

  const handleBillingSwitch = (value: string) => {
    setBillingSelected(value);
    setIsYearly(value === "1");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeProCheckout();
        setOpen(isOpen);
      }}
    >
      <DialogContent
        className={cn(
          "max-h-[88vh] w-[92vw] flex flex-col gap-0 overflow-hidden rounded-xl border shadow-lg p-0",
          showProCheckout ? "max-w-[480px]" : "max-w-4xl"
        )}
      >
        {showProCheckout ? (
          <>
            <DialogHeader className="shrink-0 space-y-1 px-5 pt-5 pb-1 text-left">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={closeProCheckout}
                  aria-label="Volver a planes"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                  Subscribe to Pro
                </DialogTitle>
              </div>
              <DialogDescription className="text-sm text-muted-foreground">
                Complete payment below. You stay in this window.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-auto px-5 pb-5 pt-2">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  fetchClientSecret: () => Promise.resolve(proCheckoutClientSecret!),
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="shrink-0 space-y-1 px-5 pt-5 pb-1 text-left">
              <DialogTitle className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                We&apos;ve got a plan that&apos;s perfect for you
              </DialogTitle>
              <DialogDescription className="max-w-xl text-sm text-muted-foreground">
                Choose the plan that fits how you use Disi. All paid usage is credit-based.
              </DialogDescription>
              <PricingSwitch
                selected={billingSelected}
                onSwitch={handleBillingSwitch}
                className="w-fit pt-3"
              />
            </DialogHeader>
            {proCheckoutError && (
              <div className="mx-5 mt-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {proCheckoutError}
              </div>
            )}
            <ScrollArea className="flex-1 min-h-0 px-5 pb-5">
          <div className="grid gap-3 py-4 md:grid-cols-3">
            {plans.map((p) => {
              const isCurrent =
                currentPlan === p.id || (currentPlan === "free" && p.id === "starter");
              const isProCheckout =
                p.action === "pro-checkout" && !isCurrent;
              const displayPrice = isYearly ? p.yearlyPrice : p.price;
              const displayPeriod = isYearly ? "year" : "month";

              return (
                <Card
                  key={p.id}
                  className={cn(
                    "relative border p-0 transition-all",
                    p.popular
                      ? "ring-2 ring-orange-500 border-orange-200 bg-orange-50/70 dark:border-orange-900/50 dark:bg-orange-950/20"
                      : "border-border bg-card"
                  )}
                >
                  <CardHeader className="space-y-1.5 p-4 pb-2 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold text-foreground md:text-xl">
                        {p.name} Plan
                      </h3>
                      {p.popular && (
                        <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-medium text-white">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {p.description}
                    </p>
                    <div className="flex min-h-[2.5rem] items-baseline gap-1 overflow-hidden">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={`${p.id}-${isYearly ? "y" : "m"}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-baseline gap-1"
                        >
                          <span className="text-2xl font-semibold tabular-nums text-foreground md:text-3xl">
                            {displayPrice < 0 ? "—" : `$${displayPrice}`}
                          </span>
                          {displayPrice >= 0 && (
                            <span className="text-sm text-muted-foreground">
                              /{displayPeriod}
                            </span>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4 pt-0">
                    {isCurrent ? (
                      <div className="mb-4 flex h-10 w-full items-center justify-center rounded-lg border border-border bg-muted/40 text-sm font-medium text-muted-foreground">
                        {p.cta}
                      </div>
                    ) : isProCheckout ? (
                      <button
                        type="button"
                        className={cn(
                          "mb-4 flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition-opacity hover:opacity-90",
                          p.popular
                            ? "border border-orange-400 bg-gradient-to-t from-orange-500 to-orange-600 text-white shadow shadow-orange-500/20"
                            : "border border-border bg-gradient-to-t from-neutral-700 to-neutral-600 text-white shadow"
                        )}
                        onClick={handleProCheckout}
                        disabled={proCheckoutLoading}
                      >
                        {proCheckoutLoading ? "Loading…" : p.buttonText}
                      </button>
                    ) : (
                      <Link
                        href={p.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "mb-4 flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition-opacity hover:opacity-90",
                          p.popular
                            ? "border border-orange-400 bg-gradient-to-t from-orange-500 to-orange-600 text-white shadow shadow-orange-500/20"
                            : "border border-border bg-gradient-to-t from-neutral-700 to-neutral-600 text-white shadow"
                        )}
                      >
                        {p.buttonText}
                      </Link>
                    )}
                    <Link
                      href="/usage"
                      onClick={() => setOpen(false)}
                      className="mb-4 flex h-9 w-full items-center justify-center rounded-lg border border-border bg-background text-sm text-foreground transition-colors hover:bg-muted/50"
                    >
                      View Billing
                    </Link>
                    <div className="space-y-2 border-t border-border pt-3">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Features
                      </h2>
                      <h4 className="text-xs font-medium text-foreground">
                        {p.includes[0]}
                      </h4>
                      <ul className="space-y-1.5">
                        {p.includes.slice(1).map((feature, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-content-center rounded-full border border-orange-500 bg-background">
                              <CheckCheck className="h-3 w-3 text-orange-500" />
                            </span>
                            <span className="text-xs text-muted-foreground leading-snug">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="pb-3 text-center text-[11px] text-muted-foreground">
            Pro subscription and credit packs are billed via Stripe. Manage from Billing.
          </p>
        </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

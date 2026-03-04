"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const REDIRECT_DELAY_MS = 2200;

/**
 * Return page for Stripe Embedded Checkout.
 * Shown in the iframe after payment success. Notifies parent to close the modal,
 * shows a clear success state, then redirects the whole window to the app.
 */
export default function UsageReturnPage() {
  const [countdown, setCountdown] = useState(REDIRECT_DELAY_MS / 1000);
  const [successContext, setSuccessContext] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSuccessContext(params.get("context"));
  }, []);

  useEffect(() => {
    window.parent.postMessage({ type: "STRIPE_EMBEDDED_SUCCESS" }, "*");

    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const context = params.get("context");
    const redirectTo = context === "pro" ? "/?pro=success" : "/?topup=success";

    const redirect = () => {
      try {
        if (window.top && window.top !== window) {
          window.top.location.href = redirectTo;
        } else {
          window.location.href = redirectTo;
        }
      } catch {
        window.location.href = redirectTo;
      }
    };

    const t = setTimeout(redirect, REDIRECT_DELAY_MS);
    const interval = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary/5 to-background px-6 py-10 text-center">
      <div className="rounded-full bg-primary/10 p-4">
        <CheckCircle2 className="h-14 w-14 text-primary" strokeWidth={1.5} />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Payment successful
        </h1>
        <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">
          {successContext === "pro"
            ? "You're now on the Pro plan. Enjoy your benefits."
            : "Your credits have been added to your account. You can start using them right away."}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Taking you to the app in {countdown}s…</span>
      </div>
    </div>
  );
}

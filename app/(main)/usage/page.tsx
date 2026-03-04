"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
  subMonths,
  format,
} from "date-fns";
import { es } from "date-fns/locale";
import { CreditCard, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BILLING_COUNTRIES, getCountryName } from "@/lib/billing-countries";
import { cn } from "@/lib/utils";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Line,
} from "recharts";

// In-app payment (no redirect) requires this key in .env.local; restart dev after adding.
const stripePublishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").trim();
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type Granularity = "daily" | "weekly" | "monthly";
type GroupBy = "none" | "model" | "category" | "provider";
type Dimension = "cost" | "tokens";

type PeriodOption = "today" | "7d" | "14d" | "30d" | "90d";

function getRangeForPeriod(period: PeriodOption): { startTs: number; endTs: number } {
  const end = endOfDay(new Date());
  const start =
    period === "today"
      ? startOfDay(new Date())
      : period === "7d"
        ? startOfDay(subDays(end, 6))
        : period === "14d"
          ? startOfDay(subDays(end, 13))
          : period === "30d"
            ? startOfDay(subDays(end, 29))
            : startOfDay(subMonths(end, 3));
  return { startTs: start.getTime(), endTs: end.getTime() };
}

function bucketKey(ts: number, granularity: Granularity): string {
  const d = new Date(ts);
  if (granularity === "daily") return format(d, "yyyy-MM-dd");
  if (granularity === "weekly") return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
  return format(startOfMonth(d), "yyyy-MM");
}

function bucketLabel(key: string, granularity: Granularity): string {
  const d = new Date(key);
  if (granularity === "daily") return format(d, "d MMM yy", { locale: es });
  if (granularity === "weekly") return `sem. ${format(d, "d MMM", { locale: es })}`;
  return format(d, "MMM yyyy", { locale: es });
}

/** All bucket keys in [startTs, endTs] for the given granularity (ensures line chart has a point per period). */
function allBucketKeysInRange(startTs: number, endTs: number, granularity: Granularity): string[] {
  const keys: string[] = [];
  let cur = startTs;
  while (cur <= endTs) {
    keys.push(bucketKey(cur, granularity));
    const d = new Date(cur);
    if (granularity === "daily") cur = d.setDate(d.getDate() + 1);
    else if (granularity === "weekly") cur = d.setDate(d.getDate() + 7);
    else cur = d.setMonth(d.getMonth() + 1);
  }
  return [...new Set(keys)].sort();
}

/** Orange for usage charts (visible on light and dark). */
const CHART_ORANGE = "hsl(28 95% 52%)";

/** Inline form to add a card via SetupIntent (no redirect). Must be rendered inside Elements. */
function AddPaymentMethodForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setLoading(true);
    try {
      const { error: confirmError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: typeof window !== "undefined" ? `${window.location.origin}/usage` : undefined,
        },
        redirect: "if_required",
      });
      if (confirmError) {
        setError(confirmError.message ?? "Error al guardar la tarjeta.");
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
          paymentMethodOrder: ["card"],
        }}
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!stripe || loading} className="rounded-lg">
          {loading ? "Guardando…" : "Guardar tarjeta"}
        </Button>
      </div>
    </form>
  );
}

const PRESET_AMOUNTS = [25, 100, 250, 500];
const MIN_AMOUNT = 5;
const MAX_AMOUNT = 2000;

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const action = searchParams.get("action");

  const [period, setPeriod] = useState<PeriodOption>("today");
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [dimension, setDimension] = useState<Dimension>("cost");
  const [embeddedClientSecret, setEmbeddedClientSecret] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const { startTs, endTs } = useMemo(() => getRangeForPeriod(period), [period]);
  const records = useQuery(api.usage_queries.getUsageInRange, { startTs, endTs });
  const user = useQuery(api.users.users.getCurrentUser);
  const invoices = useQuery(api.billing.getLatestInvoices, { limit: 5 });
  const updateInvoicedBilling = useMutation(api.billing.updateInvoicedBilling);
  const updateBillingAddress = useMutation(api.billing.updateBillingAddress);

  const { buckets, total, peak, breakdownByGroup } = useMemo(() => {
    const getValue = (r: (typeof records)[0]) => (dimension === "cost" ? r.cost : r.tokens);
    const getGroup = (r: (typeof records)[0]) =>
      groupBy === "model" ? r.modelId : groupBy === "category" ? r.category : groupBy === "provider" ? r.provider : "";
    const bucketMap = new Map<string, number>();
    const groupBucketMap = new Map<string, Record<string, number>>();
    let totalSum = 0;
    if (records?.length) {
      for (const r of records) {
        const key = bucketKey(r.timestamp, granularity);
        const v = getValue(r);
        totalSum += v;
        bucketMap.set(key, (bucketMap.get(key) ?? 0) + v);
        if (groupBy !== "none") {
          const g = getGroup(r) || "Other";
          if (!groupBucketMap.has(g)) groupBucketMap.set(g, {});
          const gb = groupBucketMap.get(g)!;
          gb[key] = (gb[key] ?? 0) + v;
        }
      }
    }
    // Fill all period buckets so the line chart has a point per interval (continuous line, not just one dot).
    const allKeys = allBucketKeysInRange(startTs, endTs, granularity);
    const sortedKeys = allKeys.length ? allKeys : Array.from(bucketMap.keys()).sort();
    const buckets = sortedKeys.map((key) => ({
      key,
      label: bucketLabel(key, granularity),
      value: bucketMap.get(key) ?? 0,
    }));
    const peak = Math.max(0, ...buckets.map((b) => b.value));
    const breakdownByGroup = Array.from(groupBucketMap.entries()).map(([group, bucketsMap]) => ({
      group,
      total: Object.values(bucketsMap).reduce((a, b) => a + b, 0),
      buckets: bucketsMap,
    }));
    return { buckets, total: totalSum, peak, breakdownByGroup };
  }, [records, granularity, dimension, groupBy, startTs, endTs]);

  const [addAmount, setAddAmount] = useState(10);
  const [addingCredits, setAddingCredits] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [invoicedLimit, setInvoicedLimit] = useState(0);
  const [invoicedSaving, setInvoicedSaving] = useState(false);
  const [billingAddress, setBillingAddress] = useState({
    name: "",
    email: "",
    country: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
  });
  const [billingAddressSaving, setBillingAddressSaving] = useState(false);
  const [billingAddressError, setBillingAddressError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [addPaymentMethodOpen, setAddPaymentMethodOpen] = useState(false);
  const [setupIntentSecret, setSetupIntentSecret] = useState<string | null>(null);
  const [addPaymentMethodError, setAddPaymentMethodError] = useState<string | null>(null);
  const [proCheckoutClientSecret, setProCheckoutClientSecret] = useState<string | null>(null);
  const [proCheckoutLoading, setProCheckoutLoading] = useState(false);
  const [proCheckoutError, setProCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.invoicedBillingLimitUsd != null) setInvoicedLimit(user.invoicedBillingLimitUsd);
    if (user?.billingAddress) {
      const c = user.billingAddress.country;
      const countryCode = BILLING_COUNTRIES.some((x) => x.code === c) ? c : BILLING_COUNTRIES.find((x) => x.name === c)?.code ?? c;
      setBillingAddress((prev) => ({
        ...prev,
        name: user.billingAddress!.name,
        email: user.billingAddress!.email,
        country: countryCode,
        line1: user.billingAddress!.line1,
        line2: user.billingAddress!.line2 ?? "",
        city: user.billingAddress!.city,
        state: user.billingAddress!.state,
        postalCode: user.billingAddress!.postalCode,
      }));
    } else if (user?.email || user?.name) {
      setBillingAddress((prev) => ({
        ...prev,
        email: user?.email ?? prev.email,
        name: user?.name ?? prev.name,
      }));
    }
  }, [user]);

  const closeAction = useCallback(() => {
    setEmbeddedClientSecret(null);
    const u = new URLSearchParams(searchParams.toString());
    u.delete("action");
    window.history.replaceState(null, "", `${window.location.pathname}${u.toString() ? `?${u}` : ""}`);
  }, [searchParams]);

  const closeProAction = useCallback(() => {
    setProCheckoutClientSecret(null);
    setProCheckoutError(null);
    const u = new URLSearchParams(searchParams.toString());
    u.delete("action");
    u.delete("yearly");
    window.history.replaceState(null, "", `${window.location.pathname}${u.toString() ? `?${u}` : ""}`);
  }, [searchParams]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "STRIPE_EMBEDDED_SUCCESS") {
        closeAction();
        setProCheckoutClientSecret(null);
        setProCheckoutError(null);
        router.replace("/?topup=success");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [closeAction, router]);

  // When landing on /usage?action=subscribe-pro, fetch embedded Pro checkout clientSecret
  useEffect(() => {
    if (action !== "subscribe-pro" || !stripePromise || proCheckoutClientSecret || proCheckoutLoading) return;
    const yearly = searchParams.get("yearly") === "1";
    setProCheckoutLoading(true);
    setProCheckoutError(null);
    fetch("/api/stripe/create-pro-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearly, embedded: true }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.data?.clientSecret) setProCheckoutClientSecret(data.data.clientSecret);
        else if (data?.error) setProCheckoutError(data.error);
        else setProCheckoutError("Could not start checkout");
      })
      .catch(() => setProCheckoutError("Network error"))
      .finally(() => setProCheckoutLoading(false));
  }, [action, searchParams, stripePromise, proCheckoutClientSecret, proCheckoutLoading]);

  const handlePurchaseCredits = async () => {
    const amount = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, addAmount));
    if (amount < MIN_AMOUNT) return;
    setAddingCredits(true);
    setEmbeddedClientSecret(null);
    try {
      const res = await fetch("/api/stripe/create-top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amount, embedded: !!stripePromise }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.data?.clientSecret && stripePromise) {
        setEmbeddedClientSecret(data.data.clientSecret);
      } else if (data.data?.url) {
        window.location.href = data.data.url;
      }
    } finally {
      setAddingCredits(false);
    }
  };

  const handleRedeemPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoError(null);
    setPromoLoading(true);
    try {
      const res = await fetch("/api/billing/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setPromoCode("");
      closeAction();
    } catch (e) {
      setPromoError(e instanceof Error ? e.message : "Error al canjear");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSaveInvoicedLimit = async () => {
    setInvoicedSaving(true);
    try {
      await updateInvoicedBilling({
        enabled: true,
        limitUsd: Math.min(25, Math.max(0, invoicedLimit)),
      });
      closeAction();
    } finally {
      setInvoicedSaving(false);
    }
  };

  const handleSaveBillingAddress = async () => {
    setBillingAddressError(null);
    if (!billingAddress.name.trim()) {
      setBillingAddressError("Name is required.");
      return;
    }
    if (!billingAddress.email.trim()) {
      setBillingAddressError("Email is required.");
      return;
    }
    if (!billingAddress.country) {
      setBillingAddressError("Please select a country.");
      return;
    }
    if (!billingAddress.line1.trim()) {
      setBillingAddressError("Address line 1 is required.");
      return;
    }
    if (!billingAddress.city.trim()) {
      setBillingAddressError("City is required.");
      return;
    }
    if (!billingAddress.postalCode.trim()) {
      setBillingAddressError("Postal / Zip code is required.");
      return;
    }
    setBillingAddressSaving(true);
    try {
      await updateBillingAddress({
        name: billingAddress.name.trim(),
        email: billingAddress.email.trim(),
        country: billingAddress.country,
        line1: billingAddress.line1.trim(),
        line2: billingAddress.line2?.trim() || undefined,
        city: billingAddress.city.trim(),
        state: billingAddress.state.trim(),
        postalCode: billingAddress.postalCode.trim(),
      });
      closeAction();
    } catch (e) {
      setBillingAddressError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBillingAddressSaving(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    setAddPaymentMethodError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/setup-intent", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Error");
      if (data.data?.clientSecret) {
        setSetupIntentSecret(data.data.clientSecret);
        setAddPaymentMethodOpen(true);
      } else {
        throw new Error("No client secret");
      }
    } catch (e) {
      setAddPaymentMethodError(e instanceof Error ? e.message : "No se pudo cargar el formulario.");
      console.error(e);
    } finally {
      setPortalLoading(false);
    }
  };

  const currentMonth = format(new Date(), "MMMM yyyy", { locale: es });
  const nextBillingDays = 7;

  const creditsRemaining = user?.balanceCredits ?? 0;
  const hasAddress = user?.billingAddress?.line1 && user?.billingAddress?.country;

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      {/* Minimal header */}
      <div className="px-6 lg:px-20 xl:px-28 py-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-lg font-medium tracking-tight text-foreground/90">Billing</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Credits, payment methods, and invoices.
          </p>
        </div>
      </div>

      <div className="flex-1 px-6 lg:px-20 xl:px-28 pb-16">
        <div className="mx-auto max-w-2xl space-y-10">
          {/* Hero: credits remaining — único bloque llamativo */}
          <section className="rounded-2xl bg-gradient-to-b from-primary/10 to-primary/5 border border-primary/10 p-6 sm:p-8">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Available balance</p>
            <p className={cn(
              "mt-1 text-4xl sm:text-5xl font-semibold tabular-nums tracking-tight",
              creditsRemaining > 0 ? "text-primary" : "text-foreground/80"
            )}>
              {creditsRemaining} <span className="text-xl font-normal text-muted-foreground">credits</span>
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Plan {user?.plan?.toUpperCase() ?? "FREE"} · Use credits for API usage or add more below.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-lg">
                <Link href="/usage?action=purchase-credits">Purchase credits</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href="/usage?action=promo">Redeem promo code</Link>
              </Button>
            </div>
          </section>

          {/* Block: Next invoice (API) — amount shown = charged to user (includes margin). See docs/BILLING-PROFIT-INTERNAL.md */}
          <section className="rounded-2xl border border-border/40 bg-card/80 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-border/30 bg-muted/5">
              <h2 className="text-[13px] font-medium text-foreground/80">Next invoice (API)</h2>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-2xl font-semibold tabular-nums">${total.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">Next period in {nextBillingDays} days</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Amounts shown are what you’re charged (include margin). Estimated API cost: ${(total / 1.15).toFixed(2)}.
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs text-muted-foreground">
                  {dimension === "cost" ? "USD" : "Tokens"} by {granularity}
                </span>
                <div className="flex rounded-lg border border-border/40 p-0.5 bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setChartType("bar")}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md transition-colors",
                      chartType === "bar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Barras
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType("line")}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md transition-colors",
                      chartType === "line" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Línea
                  </button>
                </div>
              </div>
              <div className="rounded-xl bg-muted/20 border border-border/40 p-4 min-h-[220px]">
                {buckets.length === 0 || total === 0 ? (
                  <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-center px-4">
                    <p className="text-muted-foreground text-xs">No hay uso en este período.</p>
                    <p className="text-muted-foreground/80 text-[11px] max-w-[260px]">Los datos se actualizan cuando se procesan las solicitudes. Si acabas de hacer una, espera unos segundos y recarga la página.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    {chartType === "bar" ? (
                      <BarChart
                        data={buckets.map((b) => ({ label: b.label, value: b.value, full: dimension === "cost" ? `$${b.value.toFixed(4)}` : b.value.toLocaleString() }))}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" tickFormatter={(v) => (dimension === "cost" ? `$${v.toFixed(2)}` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(value: number) => [dimension === "cost" ? `$${Number(value).toFixed(4)}` : Number(value).toLocaleString(), dimension === "cost" ? "USD" : "Tokens"]}
                          labelFormatter={(label) => String(label)}
                        />
                        <Bar dataKey="value" fill={CHART_ORANGE} radius={[4, 4, 0, 0]} opacity={0.9} />
                      </BarChart>
                    ) : (
                      <AreaChart
                        data={buckets.map((b) => ({ label: b.label, value: b.value, full: dimension === "cost" ? `$${b.value.toFixed(4)}` : b.value.toLocaleString() }))}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_ORANGE} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={CHART_ORANGE} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" tickFormatter={(v) => (dimension === "cost" ? `$${v.toFixed(2)}` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(value: number) => [dimension === "cost" ? `$${Number(value).toFixed(4)}` : Number(value).toLocaleString(), dimension === "cost" ? "USD" : "Tokens"]}
                          labelFormatter={(label) => String(label)}
                        />
                        <Area type="monotone" dataKey="value" stroke={CHART_ORANGE} fill="url(#usageGradient)" strokeWidth={2.5} />
                        <Line type="monotone" dataKey="value" stroke={CHART_ORANGE} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 5 }} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          {/* Block: API credits */}
          <section className="rounded-2xl border border-border/40 bg-card/80 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-border/30 bg-muted/5">
              <h2 className="text-[13px] font-medium text-foreground/80">API credits</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Add credits to pay for API usage.</p>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Free credits</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">$0.00</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">Promotional credits granted to your account.</p>
                  <Button variant="ghost" size="sm" className="mt-3 h-8 text-xs text-muted-foreground" asChild>
                    <Link href="/usage?action=promo">Redeem promo code</Link>
                  </Button>
                </div>
                <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Purchased credits</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">{creditsRemaining} credits</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">Non-refundable. Deducted as you use the API.</p>
                  <Button variant="outline" size="sm" className="mt-3 h-8 text-xs rounded-lg" asChild>
                    <Link href="/usage?action=purchase-credits">Purchase credits</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Block: Invoiced billing */}
          <section className="rounded-2xl border border-border/40 bg-card/80 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-border/30 bg-muted/5">
              <h2 className="text-[13px] font-medium text-foreground/80">Invoiced billing</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Invoice usage at month end, up to a spend cap.</p>
            </div>
            <div className="p-4 sm:p-6">
              {user?.invoicedBillingEnabled ? (
                <p className="text-[13px] text-muted-foreground">Limit: <span className="font-medium text-foreground">${user.invoicedBillingLimitUsd ?? 0}/month</span>.</p>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-destructive/90 flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-destructive" /> Disabled
                  </span>
                  <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" asChild>
                    <Link href="/usage?action=invoiced-billing">Enable invoiced billing</Link>
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Block: Billing details */}
          <section className="rounded-2xl border border-border/40 bg-card/80 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-border/30 bg-muted/5 flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium text-foreground/80">Billing details</h2>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href="/usage?action=billing-address">Edit</Link>
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs rounded-lg"
                  disabled={portalLoading || !stripePromise}
                  onClick={handleAddPaymentMethod}
                >
                  {portalLoading ? "…" : "Añadir tarjeta"}
                </Button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <dl className="text-[13px] space-y-3">
                <div>
                  <dt className="text-muted-foreground text-[11px] uppercase tracking-wider">Email</dt>
                  <dd className="font-medium mt-0.5">{user?.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-[11px] uppercase tracking-wider">Address</dt>
                  <dd className="font-medium mt-0.5">
                    {hasAddress
                      ? `${user!.billingAddress!.line1}, ${user!.billingAddress!.city}, ${getCountryName(user!.billingAddress!.country)}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Block: Latest invoices */}
          <section className="rounded-2xl border border-border/40 bg-card/80 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-border/30 bg-muted/5">
              <h2 className="text-[13px] font-medium text-foreground/80">Latest invoices</h2>
            </div>
            <div className="p-0">
              {!invoices?.length ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No invoices yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/20">
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Invoice #</th>
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Amount</th>
                        <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground">#{inv.stripeEventId.slice(-10)}</td>
                          <td className="py-2.5 px-4">{format(inv.date, "d MMM yyyy", { locale: es })}</td>
                          <td className="py-2.5 px-4">{inv.type}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">${inv.amount.toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="rounded-md bg-muted/80 px-2 py-0.5 text-[11px]">{inv.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Block: Usage breakdown */}
          <section className="rounded-2xl border border-border/40 bg-card/80 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-border/30 bg-muted/5">
              <h2 className="text-[13px] font-medium text-foreground/80">Usage breakdown</h2>
              <p className="text-xs text-muted-foreground mt-0.5">By period; optional grouping.</p>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
                <SelectTrigger className="w-[100px] h-8 text-xs bg-muted/20 border-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger className="w-[100px] h-8 text-xs bg-muted/20 border-border/30">
                  <SelectValue placeholder="Agrupar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  <SelectItem value="model">Modelo</SelectItem>
                  <SelectItem value="category">Categoría</SelectItem>
                  <SelectItem value="provider">Proveedor</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dimension} onValueChange={(v) => setDimension(v as Dimension)}>
                <SelectTrigger className="w-[110px] h-8 text-xs bg-muted/20 border-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cost">Coste (USD)</SelectItem>
                  <SelectItem value="tokens">Tokens</SelectItem>
                </SelectContent>
              </Select>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
                <SelectTrigger className="w-[120px] h-8 text-xs bg-muted/20 border-border/30">
                  <Calendar className="w-3 h-3 mr-1.5 inline text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="7d">7 días</SelectItem>
                  <SelectItem value="14d">14 días</SelectItem>
                  <SelectItem value="30d">30 días</SelectItem>
                  <SelectItem value="90d">90 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/30">
              {buckets.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">Sin registros</p>
              ) : groupBy !== "none" && breakdownByGroup.length > 0 ? (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Grupo</th>
                      <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownByGroup.map((row) => (
                      <tr key={row.group} className="border-b border-border/20">
                        <td className="py-2.5 px-4">{row.group}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {dimension === "cost" ? `$${row.total.toFixed(4)}` : row.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Periodo</th>
                      <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">
                        {dimension === "cost" ? "Coste (USD)" : "Tokens"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((b) => (
                      <tr key={b.key} className="border-b border-border/20">
                        <td className="py-2.5 px-4">{b.label}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {dimension === "cost" ? `$${b.value.toFixed(4)}` : b.value.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modal: Promo code */}
      <Dialog open={action === "promo"} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogTitle>Promo code</DialogTitle>
          <DialogDescription>Redeem a code for free credits.</DialogDescription>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="promo-code">Code</Label>
              <Input
                id="promo-code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="e.g. WELCOME100"
                className="h-9 font-mono"
              />
            </div>
            {promoError && <p className="text-sm text-destructive">{promoError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeAction}>Cancel</Button>
              <Button onClick={handleRedeemPromo} disabled={promoLoading || !promoCode.trim()}>
                {promoLoading ? "Applying…" : "Apply"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Subscribe to Pro — in-app embedded checkout (no redirect) */}
      <Dialog open={action === "subscribe-pro"} onOpenChange={(open) => !open && closeProAction()}>
        <DialogContent className="rounded-xl flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[480px]">
          <DialogTitle className="shrink-0">Subscribe to Pro</DialogTitle>
          <DialogDescription className="shrink-0">
            {proCheckoutClientSecret
              ? "Complete payment below. You stay on this page."
              : "Complete your Pro subscription. Payment is secure and in-app."}
          </DialogDescription>
          {!stripePromise ? (
            <div className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
              Add <code className="rounded bg-muted px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to .env.local and restart to see checkout here.
            </div>
          ) : proCheckoutError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{proCheckoutError}</p>
              <Button variant="outline" size="sm" onClick={closeProAction}>Close</Button>
            </div>
          ) : proCheckoutLoading ? (
            <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
              Loading checkout…
            </div>
          ) : proCheckoutClientSecret && stripePromise ? (
            <div className="min-h-0 flex-1 overflow-auto pt-2">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  fetchClientSecret: () => Promise.resolve(proCheckoutClientSecret),
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modal: Purchase credits — in-app embedded checkout (no redirect) */}
      <Dialog open={action === "purchase-credits"} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent
          className={cn(
            "rounded-xl flex max-h-[90vh] flex-col overflow-hidden",
            embeddedClientSecret ? "sm:max-w-[480px]" : "sm:max-w-sm"
          )}
        >
          <DialogTitle className="shrink-0">Purchase credits</DialogTitle>
          <DialogDescription className="shrink-0">
            {embeddedClientSecret
              ? "Complete payment below. You stay on this page."
              : "Choose amount in USD. Payment is secure and in-app."}
          </DialogDescription>
          {!stripePromise && !embeddedClientSecret ? (
            <div className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
              Para ver la pasarela aquí (sin redirigir a Stripe), añade en <code className="rounded bg-muted px-1">.env.local</code>:{" "}
              <code className="rounded bg-muted px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...</code> (Stripe → Developers → API keys). Reinicia el servidor después.
            </div>
          ) : null}
          {embeddedClientSecret && stripePromise ? (
            <div className="min-h-0 flex-1 overflow-auto pt-2">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  fetchClientSecret: () => Promise.resolve(embeddedClientSecret),
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="flex gap-2 flex-wrap">
                {PRESET_AMOUNTS.map((n) => (
                  <Button
                    key={n}
                    variant={addAmount === n ? "default" : "outline"}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setAddAmount(n)}
                  >
                    ${n}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-amount">Custom amount ($5 – $2,000)</Label>
                <Input
                  id="custom-amount"
                  type="number"
                  min={MIN_AMOUNT}
                  max={MAX_AMOUNT}
                  value={addAmount}
                  onChange={(e) =>
                    setAddAmount(
                      Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, Number(e.target.value) || MIN_AMOUNT))
                    )
                  }
                  className="h-9 w-28"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={closeAction}>
                  Cancel
                </Button>
                <Button onClick={handlePurchaseCredits} disabled={addingCredits} className="rounded-lg">
                  {addingCredits ? "Loading…" : "Pay with card"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Add payment method (card) — in-page form, no redirect */}
      <Dialog
        open={addPaymentMethodOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAddPaymentMethodOpen(false);
            setSetupIntentSecret(null);
            setAddPaymentMethodError(null);
          }
        }}
      >
        <DialogContent className="rounded-xl sm:max-w-[440px]">
          <DialogTitle>Añadir tarjeta</DialogTitle>
          <DialogDescription>
            Añade un medio de pago para comprar créditos. No se realiza ningún cargo hasta que uses los créditos.
          </DialogDescription>
          {addPaymentMethodError && !setupIntentSecret ? (
            <p className="text-sm text-destructive pt-2">{addPaymentMethodError}</p>
          ) : null}
          {setupIntentSecret && stripePromise ? (
            <div className="pt-2">
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: setupIntentSecret,
                  appearance: { theme: "stripe" },
                }}
              >
                <AddPaymentMethodForm
                  onSuccess={() => {
                    setAddPaymentMethodOpen(false);
                    setSetupIntentSecret(null);
                  }}
                  onCancel={() => {
                    setAddPaymentMethodOpen(false);
                    setSetupIntentSecret(null);
                  }}
                />
              </Elements>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modal: Invoiced billing */}
      <Dialog open={action === "invoiced-billing"} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogTitle>Invoiced billing limit</DialogTitle>
          <DialogDescription>
            Maximum USD to spend on API usage per month. Invoicing is not yet active; this only saves the limit.
          </DialogDescription>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="limit-usd">Monthly limit (USD)</Label>
              <Input
                id="limit-usd"
                type="number"
                min={0}
                max={25}
                value={invoicedLimit}
                onChange={(e) => setInvoicedLimit(Math.min(25, Math.max(0, Number(e.target.value) || 0)))}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">Up to $25</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeAction}>Cancel</Button>
              <Button onClick={handleSaveInvoicedLimit} disabled={invoicedSaving} className="rounded-lg">
                {invoicedSaving ? "Saving…" : "Save limit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Billing address */}
      <Dialog open={action === "billing-address"} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Billing address</DialogTitle>
          <DialogDescription>
            This address will appear on your invoices.
          </DialogDescription>
          <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ba-name">Name</Label>
                <Input
                  id="ba-name"
                  value={billingAddress.name}
                  onChange={(e) => setBillingAddress((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Acme Inc."
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ba-email">Email</Label>
                <Input
                  id="ba-email"
                  type="email"
                  value={billingAddress.email}
                  onChange={(e) => setBillingAddress((p) => ({ ...p, email: e.target.value }))}
                  placeholder="billing@example.com"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select
                value={billingAddress.country || "_"}
                onValueChange={(v) => setBillingAddress((p) => ({ ...p, country: v === "_" ? "" : v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Select country</SelectItem>
                  {BILLING_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ba-line1">Address line 1</Label>
              <Input
                id="ba-line1"
                value={billingAddress.line1}
                onChange={(e) => setBillingAddress((p) => ({ ...p, line1: e.target.value }))}
                placeholder="123 Main St."
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ba-line2">Address line 2 (optional)</Label>
              <Input
                id="ba-line2"
                value={billingAddress.line2}
                onChange={(e) => setBillingAddress((p) => ({ ...p, line2: e.target.value }))}
                placeholder="Apt. 4"
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ba-city">City</Label>
                <Input
                  id="ba-city"
                  value={billingAddress.city}
                  onChange={(e) => setBillingAddress((p) => ({ ...p, city: e.target.value }))}
                  placeholder="New York"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ba-state">State / Province</Label>
                <Input
                  id="ba-state"
                  value={billingAddress.state}
                  onChange={(e) => setBillingAddress((p) => ({ ...p, state: e.target.value }))}
                  placeholder="NY"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ba-postal">Postal / Zip code</Label>
              <Input
                id="ba-postal"
                value={billingAddress.postalCode}
                onChange={(e) => setBillingAddress((p) => ({ ...p, postalCode: e.target.value }))}
                placeholder="10001"
                className="h-9"
              />
            </div>
            {billingAddressError && (
              <p className="text-sm text-destructive">{billingAddressError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeAction}>Cancel</Button>
              <Button onClick={handleSaveBillingAddress} disabled={billingAddressSaving}>
                {billingAddressSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

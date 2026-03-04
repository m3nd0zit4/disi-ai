import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const CREDITS_PER_USD = Number(process.env.BILLING_CREDITS_PER_USD) || 100;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function mapStripeStatus(
  status: string
): "active" | "canceled" | "past_due" | "trialing" {
  switch (status) {
    case "active":
    case "trialing":
      return status;
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "past_due":
    case "incomplete":
    case "unpaid":
    default:
      return "past_due";
  }
}

export async function POST(req: Request) {
  let Stripe: typeof import("stripe").default;
  try {
    Stripe = (await import("stripe")).default;
  } catch {
    console.error("[webhooks/stripe] stripe package not installed. Run: npm install stripe");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  if (!WEBHOOK_SECRET) {
    console.error("[webhooks/stripe] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhooks/stripe] Signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string | null;

    if (session.mode === "subscription" && session.subscription && customerId) {
      const proPriceIds = [
        process.env.STRIPE_PRO_PRICE_ID,
        process.env.STRIPE_PRO_PRICE_ID_YEARLY,
      ].filter(Boolean) as string[];
      if (proPriceIds.length > 0) {
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subId);
          const priceId = subscription.items.data[0]?.price?.id;
          if (priceId && proPriceIds.includes(priceId)) {
            const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
            const secret = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
            if (secret) {
              const status = mapStripeStatus(subscription.status);
              await convex.action(api.usage_actions.setProSubscriptionFromStripe, {
                secret,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscription.id,
                subscriptionStatus: status,
                subscriptionEndDate: subscription.current_period_end * 1000,
              });
              // Grant initial Pro credits on first subscription (so user gets them even if invoice.paid is delayed or fails)
              await convex.action(api.usage_actions.addProMonthlyCreditsToUser, {
                secret,
                stripeCustomerId: customerId,
              });
            }
          }
        } catch (err) {
          console.error("[webhooks/stripe] setProSubscriptionFromStripe failed:", err);
        }
      }
    }

    if (session.mode === "payment") {
      const amountTotal = session.amount_total ?? 0;
      const amountUsd = amountTotal / 100;
      const amountCredits = Math.round(amountUsd * CREDITS_PER_USD);

      if (customerId && amountCredits > 0) {
        try {
          const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
          const secret = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
          if (!secret) {
            console.error("[webhooks/stripe] No USAGE_RECORD_SECRET or FILE_WORKER_SECRET");
            return NextResponse.json({ error: "Server config error" }, { status: 500 });
          }
          await convex.action(api.usage_actions.addCreditsToUser, {
            secret,
            stripeCustomerId: customerId,
            amountCredits,
            stripeSessionId: session.id,
            amountUsd,
          });
        } catch (err) {
          console.error("[webhooks/stripe] addCreditsToUser failed:", err);
          return NextResponse.json({ error: "Failed to add credits" }, { status: 500 });
        }
      }
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    const billingReason = invoice.billing_reason ?? "";
    const proPriceIds = [
      process.env.STRIPE_PRO_PRICE_ID,
      process.env.STRIPE_PRO_PRICE_ID_YEARLY,
    ].filter(Boolean) as string[];
    // Only add credits on renewal (subscription_cycle). Initial credits are granted in checkout.session.completed.
    if (
      subscriptionId &&
      customerId &&
      proPriceIds.length > 0 &&
      billingReason === "subscription_cycle"
    ) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price?.id;
        if (priceId && proPriceIds.includes(priceId)) {
          const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
          const secret = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
          if (secret) {
            await convex.action(api.usage_actions.addProMonthlyCreditsToUser, {
              secret,
              stripeCustomerId: customerId,
            });
          }
        }
      } catch (err) {
        console.error("[webhooks/stripe] addProMonthlyCreditsToUser failed:", err);
      }
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    const proPriceIds = [
      process.env.STRIPE_PRO_PRICE_ID,
      process.env.STRIPE_PRO_PRICE_ID_YEARLY,
    ].filter(Boolean) as string[];
    if (customerId && proPriceIds.length > 0) {
      const priceId = subscription.items.data[0]?.price?.id;
      if (priceId && proPriceIds.includes(priceId)) {
        try {
          const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
          const secret = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
          if (secret) {
            const status = event.type === "customer.subscription.deleted" ? "canceled" : mapStripeStatus(subscription.status);
            await convex.action(api.usage_actions.setProSubscriptionFromStripe, {
              secret,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
              subscriptionStatus: status,
              subscriptionEndDate: (subscription.current_period_end ?? 0) * 1000,
            });
          }
        } catch (err) {
          console.error("[webhooks/stripe] setProSubscriptionFromStripe (subscription updated/deleted) failed:", err);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}

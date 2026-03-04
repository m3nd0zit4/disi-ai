import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const { userId: clerkId, getToken } = await auth();
    if (!clerkId) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const proPriceIdMonthly = process.env.STRIPE_PRO_PRICE_ID;
    const proPriceIdYearly = process.env.STRIPE_PRO_PRICE_ID_YEARLY;

    if (!stripeSecret) {
      return apiError("Stripe is not configured (STRIPE_SECRET_KEY).", 503, "SERVICE_UNAVAILABLE");
    }
    if (!proPriceIdMonthly) {
      return apiError(
        "Pro subscription is not configured. Set STRIPE_PRO_PRICE_ID in your environment (Stripe Dashboard: create a recurring Price for Pro).",
        503,
        "SERVICE_UNAVAILABLE"
      );
    }

    let body: { yearly?: boolean; embedded?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // no body or invalid JSON → use monthly, redirect mode
    }
    const yearly = Boolean(body?.yearly);
    const embedded = Boolean(body?.embedded);
    const proPriceId = yearly && proPriceIdYearly ? proPriceIdYearly : proPriceIdMonthly;

    const token = await getToken({ template: "convex" });
    const convex = getConvexClient(token ?? undefined);
    const user = await convex.query(api.users.users.getCurrentUser);
    if (!user) {
      return apiError("User not found", 404, "USER_NOT_FOUND");
    }

    const stripe = new Stripe(stripeSecret);

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { convexUserId: user._id },
      });
      stripeCustomerId = customer.id;
      await convex.mutation(api.users.users.setStripeCustomerId, {
        stripeCustomerId,
      });
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: proPriceId, quantity: 1 }],
      ...(embedded
        ? {
            ui_mode: "embedded" as const,
            return_url: `${origin}/usage/return?session_id={CHECKOUT_SESSION_ID}&context=pro`,
          }
        : {
            success_url: `${origin}/usage?pro=success`,
            cancel_url: `${origin}/pricing?pro=cancel`,
          }),
      subscription_data: {
        metadata: { convexUserId: user._id },
      },
      metadata: { convexUserId: user._id, plan: "pro" },
    });

    if (embedded && session.client_secret) {
      return apiSuccess({ clientSecret: session.client_secret });
    }
    const url = session.url ?? null;
    if (!url) {
      console.error("[create-pro-subscription] Stripe returned no checkout URL");
      return apiError(
        "Stripe could not create the checkout session. Check that the configured Price ID (monthly or yearly) is a valid recurring Price in Stripe.",
        502,
        "STRIPE_ERROR"
      );
    }
    return apiSuccess({ url });
  } catch (e) {
    console.error("[create-pro-subscription]", e);
    return apiError(
      e instanceof Error ? e.message : "Internal error",
      500,
      "INTERNAL_ERROR"
    );
  }
}

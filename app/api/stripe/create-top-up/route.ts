import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";
import { apiError, apiSuccess } from "@/lib/api-response";

const MIN_AMOUNT_USD = 5;
const CREDITS_PER_USD = Number(process.env.BILLING_CREDITS_PER_USD) || 100;

export async function POST(req: Request) {
  try {
    const { userId: clerkId, getToken } = await auth();
    if (!clerkId) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await req.json().catch(() => ({}));
    const amountUsd = Number(body?.amountUsd ?? body?.amount);
    const embedded = Boolean(body?.embedded);
    if (!Number.isFinite(amountUsd) || amountUsd < MIN_AMOUNT_USD) {
      return apiError(
        `Amount must be at least ${MIN_AMOUNT_USD} USD`,
        400,
        "INVALID_INPUT"
      );
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return apiError("Stripe not configured", 503, "SERVICE_UNAVAILABLE");
    }

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
    const returnUrl = `${origin}/usage/return?session_id={CHECKOUT_SESSION_ID}`;
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amountUsd * 100),
            product_data: {
              name: "Credits top-up",
              description: `${Math.round(amountUsd * CREDITS_PER_USD)} credits`,
            },
          },
          quantity: 1,
        },
      ],
      ...(embedded
        ? {
            ui_mode: "embedded" as const,
            return_url: returnUrl,
          }
        : {
            success_url: `${origin}/usage?topup=success`,
            cancel_url: `${origin}/usage?topup=cancel`,
          }),
      metadata: {
        amountUsd: String(amountUsd),
        amountCredits: String(Math.round(amountUsd * CREDITS_PER_USD)),
        convexUserId: user._id,
      },
    });

    if (embedded && session.client_secret) {
      return apiSuccess({ clientSecret: session.client_secret });
    }
    return apiSuccess({ url: session.url ?? null });
  } catch (e) {
    console.error("[create-top-up]", e);
    return apiError(
      e instanceof Error ? e.message : "Internal error",
      500,
      "INTERNAL_ERROR"
    );
  }
}

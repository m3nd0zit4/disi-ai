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
    if (!stripeSecret) {
      return apiError("Stripe not configured", 503, "SERVICE_UNAVAILABLE");
    }

    const token = await getToken({ template: "convex" });
    const convex = getConvexClient(token ?? undefined);
    const user = await convex.query(api.users.users.getCurrentUser);
    if (!user?.stripeCustomerId) {
      return apiError("No billing account. Purchase credits first to create one.", 400, "NO_CUSTOMER");
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const returnUrl = `${origin}/usage`;

    const stripe = new Stripe(stripeSecret);
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return apiSuccess({ url: session.url });
  } catch (e) {
    console.error("[customer-portal]", e);
    return apiError(
      e instanceof Error ? e.message : "Internal error",
      500,
      "INTERNAL_ERROR"
    );
  }
}

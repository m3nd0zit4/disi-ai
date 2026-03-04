import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";
import { apiError, apiSuccess } from "@/lib/api-response";

/**
 * Create a SetupIntent so the client can add a payment method (card) without redirect.
 * Creates a Stripe customer if the user doesn't have one yet.
 */
export async function POST() {
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

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      usage: "off_session",
      payment_method_types: ["card"],
    });

    if (!setupIntent.client_secret) {
      return apiError("Failed to create setup intent", 500, "INTERNAL_ERROR");
    }

    return apiSuccess({ clientSecret: setupIntent.client_secret });
  } catch (e) {
    console.error("[setup-intent]", e);
    return apiError(
      e instanceof Error ? e.message : "Internal error",
      500,
      "INTERNAL_ERROR"
    );
  }
}

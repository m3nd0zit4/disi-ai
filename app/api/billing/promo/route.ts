import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";
import { apiError, apiSuccess } from "@/lib/api-response";

/**
 * POST: Redeem a promo code. Body: { code: string }.
 */
export async function POST(req: Request) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }
    if (!getToken) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) {
      return apiError("Código requerido", 400, "INVALID_INPUT");
    }

    const token = await getToken({ template: "convex" });
    const convex = getConvexClient(token ?? undefined);
    await convex.mutation(api.billing.redeemPromoCode, { code });
    return apiSuccess({ message: "Código canjeado correctamente" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al canjear";
    const code = message.includes("ya fue canjeado") ? "ALREADY_USED" : message.includes("no válido") ? "INVALID_CODE" : "INTERNAL_ERROR";
    return apiError(message, 400, code);
  }
}

import { NextResponse } from "next/server";

/**
 * Standard API response helpers for consistent JSON shape across routes.
 *
 * Success: { success: true, data?: T, message?: string }
 * Error:   { success: false, error: string, code?: string }
 *
 * Use apiError for 4xx/5xx and apiSuccess for 2xx.
 */

/** Standard success payload */
export interface ApiSuccessPayload<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

/** Standard error payload */
export interface ApiErrorPayload {
  success: false;
  error: string;
  code?: string;
  requestId?: string;
}

type ApiPayload<T = unknown> = ApiSuccessPayload<T> | ApiErrorPayload;

/**
 * Return a JSON success response with consistent shape.
 * Use for 200 (default), 201 (created), etc.
 */
export function apiSuccess<T>(
  data?: T,
  options?: { status?: number; message?: string }
): NextResponse<ApiSuccessPayload<T>> {
  const { status = 200, message } = options ?? {};
  const body: ApiSuccessPayload<T> = {
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
  };
  return NextResponse.json(body, { status });
}

/**
 * Return a JSON error response with consistent shape.
 * Use for 400, 401, 404, 500, etc.
 * requestId is optional (pass from request header X-Request-Id or generate).
 */
export function apiError(
  message: string,
  status: number = 500,
  code?: string,
  requestId?: string
): NextResponse<ApiErrorPayload> {
  const body: ApiErrorPayload = {
    success: false,
    error: message,
    ...(code && { code }),
    ...(requestId && { requestId }),
  };
  return NextResponse.json(body, { status });
}

/**
 * Wrap an async handler to catch errors and return apiError(500).
 * Use in route handlers: export const POST = withApiErrorHandler(async (req) => { ... });
 */
export function withApiErrorHandler(
  handler: (req: Request) => Promise<NextResponse>
): (req: Request) => Promise<NextResponse> {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      console.error("[API] Unhandled error:", err);
      const message = err instanceof Error ? err.message : "Internal server error";
      return apiError(message, 500, "INTERNAL_ERROR");
    }
  };
}

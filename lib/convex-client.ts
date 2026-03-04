import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
let clientInstance: ConvexHttpClient | null = null;

/**
 * Returns a single ConvexHttpClient instance per process.
 * When authToken is provided, sets it on the client before returning.
 * Use for server-side API routes and serverless functions.
 *
 * Note: In a long-lived process with concurrent requests using different tokens,
 * prefer calling getConvexClient() and setAuth(token) within the same request
 * and avoid sharing the client across async boundaries with other requests.
 */
export function getConvexClient(authToken?: string): ConvexHttpClient {
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined");
  }
  if (!clientInstance) {
    clientInstance = new ConvexHttpClient(convexUrl);
  }
  if (authToken !== undefined) {
    clientInstance.setAuth(authToken);
  }
  return clientInstance;
}

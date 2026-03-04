import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

interface ChannelHandler {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  cleanup: () => void;
}

let sharedSubscriber: Redis | null = null;
const channelHandlers = new Map<string, ChannelHandler>();
const subscribedChannels = new Set<string>();

function getSharedSubscriber(): Redis | null {
  if (!redisUrl) return null;
  if (!sharedSubscriber) {
    sharedSubscriber = new Redis(redisUrl);
    sharedSubscriber.on("message", (channel: string, message: string) => {
      const handler = channelHandlers.get(channel);
      if (handler) {
        try {
          const data = `data: ${message}\n\n`;
          handler.controller.enqueue(handler.encoder.encode(data));
          try {
            const parsed = JSON.parse(message);
            if (parsed.status === "completed" || parsed.status === "error") {
              handler.cleanup();
            }
          } catch {
            // ignore parse errors
          }
        } catch (e) {
          // controller may be closed
          handler.cleanup();
        }
      }
    });
    sharedSubscriber.on("error", (err) => {
      console.error("[redis-sse-pool] Subscriber error:", err);
    });
  }
  return sharedSubscriber;
}

/**
 * Subscribe an SSE stream to Redis channel `stream:${responseId}`.
 * Uses a single shared subscriber; messages are routed to the correct controller.
 * Call unsubscribe when the stream closes.
 */
export function subscribeStream(
  responseId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  onClose: () => void
): boolean {
  const subscriber = getSharedSubscriber();
  if (!subscriber) return false;

  const channel = `stream:${responseId}`;
  const cleanup = () => {
    unsubscribeStream(responseId);
    onClose();
  };

  channelHandlers.set(channel, { controller, encoder, cleanup });

  if (!subscribedChannels.has(channel)) {
    subscribedChannels.add(channel);
    subscriber.subscribe(channel).catch((err) => {
      console.error("[redis-sse-pool] Subscribe failed:", err);
      channelHandlers.delete(channel);
      subscribedChannels.delete(channel);
      onClose();
    });
  }
  return true;
}

/**
 * Unsubscribe and remove the channel from the shared subscriber.
 */
export async function unsubscribeStream(responseId: string): Promise<void> {
  const channel = `stream:${responseId}`;
  channelHandlers.delete(channel);
  if (subscribedChannels.has(channel) && sharedSubscriber) {
    subscribedChannels.delete(channel);
    try {
      await sharedSubscriber.unsubscribe(channel);
    } catch (e) {
      console.warn("[redis-sse-pool] Unsubscribe error:", e);
    }
  }
}

/**
 * Whether the pool can be used (Redis URL configured).
 */
export function isPoolAvailable(): boolean {
  return !!redisUrl;
}

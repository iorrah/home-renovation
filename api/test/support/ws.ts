import { createClient, type Client } from 'graphql-ws';

export type WsResult<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
};

/**
 * Opens a WebSocket subscription as a user (or anonymously) and collects what arrives.
 * `next()` resolves with the next result, or rejects after a timeout so a missing event fails
 * the test instead of hanging it.
 */
export function subscribe<T>(
  url: string,
  query: string,
  variables: Record<string, unknown>,
  token?: string,
) {
  const client: Client = createClient({
    url,
    retryAttempts: 0,
    connectionParams: token ? { authorization: `Bearer ${token}` } : {},
  });
  const received: WsResult<T>[] = [];
  const waiting: ((result: WsResult<T>) => void)[] = [];

  client.subscribe<T>(
    { query, variables },
    {
      next: (result) => {
        const resolve = waiting.shift();
        if (resolve) resolve(result as WsResult<T>);
        else received.push(result as WsResult<T>);
      },
      error: () => {},
      complete: () => {},
    },
  );

  return {
    next(timeoutMs = 3_000): Promise<WsResult<T>> {
      const ready = received.shift();
      if (ready) return Promise.resolve(ready);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('No subscription event arrived')),
          timeoutMs,
        );
        waiting.push((result) => {
          clearTimeout(timer);
          resolve(result);
        });
      });
    },
    /** Results that arrived and were not consumed by next(). */
    pending: () => received.length,
    dispose: () => client.dispose(),
  };
}

/**
 * graphql-ws does not acknowledge a subscription, and the server subscribes to Redis
 * asynchronously, so give it a moment before publishing.
 */
export const subscriptionReady = () => new Promise((resolve) => setTimeout(resolve, 300));

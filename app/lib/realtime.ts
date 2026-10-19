'use client';

import { createClient, type Client } from 'graphql-ws';
import { API_URL } from './config';
import { getSession } from './session';

/**
 * One WebSocket per browser tab, shared by every live subscription. It connects when the first
 * subscription starts and reconnects on its own if the network drops.
 */
let client: Client | undefined;
let connected = false;

/** Whether the shared WebSocket is open right now (for a page that starts after it opened). */
export function isRealtimeConnected(): boolean {
  return connected;
}

export function getRealtimeClient(): Client {
  if (client) return client;
  client = createClient({
    url: `${API_URL.replace(/^http/, 'ws')}/graphql`,
    // Browsers cannot put headers on a WebSocket, so the token goes in the connection payload.
    // A function, so every reconnect sends the current token.
    connectionParams: () => {
      const session = getSession();
      return session ? { authorization: `Bearer ${session.accessToken}` } : {};
    },
    retryAttempts: Infinity,
  });
  client.on('connected', () => (connected = true));
  client.on('closed', () => (connected = false));
  return client;
}

/** Closes the socket on logout, so the next user does not reuse the previous user's connection. */
export function closeRealtimeClient(): void {
  void client?.dispose();
  client = undefined;
  connected = false;
}

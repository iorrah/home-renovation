'use client';

import { useSyncExternalStore } from 'react';
import type { User } from './types';

/**
 * The logged-in user and their access token, kept in localStorage so a page reload keeps you
 * signed in. Trade-off (see README): any script running on the page could read the token, so an
 * XSS bug would expose it. An httpOnly cookie would avoid that but needs a proxy for every API
 * call and the WebSocket.
 */
export type Session = { accessToken: string; user: User };

const STORAGE_KEY = 'home-renovation.session';
const listeners = new Set<() => void>();
// undefined = not read yet. React needs the same object back on every read until it changes.
let cached: Session | null | undefined;

function readFromStorage(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (isExpired(session.accessToken)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/** Reads the token's `exp` claim (seconds since 1970). The API still verifies the signature. */
function isExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return exp !== undefined && exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

export function getSession(): Session | null {
  if (cached === undefined) cached = readFromStorage();
  return cached;
}

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  cached = session;
  notify();
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
  cached = null;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Logging in or out in another tab updates this one too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cached = undefined;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * The current session, or null when logged out. Returns undefined during server rendering and
 * the first browser render, because the server cannot see localStorage.
 */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, getSession, () => undefined);
}

/** The logged-in user, for pages inside the (app) route group, where the guard ensures one. */
export function useCurrentUser(): User {
  const session = useSession();
  if (!session) throw new Error('useCurrentUser used outside the authenticated layout');
  return session.user;
}

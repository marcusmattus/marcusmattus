import type { SessionRecord } from '../shared/types';

export interface AuthProvider {
  readonly name: string;
  /** Email a one-time code. Creates the account on first use (sign up). */
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<SessionRecord>;
  /** Returns a still-valid session from a previous run, or null. */
  restore(): Promise<SessionRecord | null>;
  signOut(): Promise<void>;
}

/** Read the `exp` claim of a JWT (seconds) as milliseconds. No signature check: the server verifies. */
export function jwtExpiryMs(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch { return null; }
}

let provider: Promise<AuthProvider> | null = null;

/**
 * Privy in production. The development mock provider is only reachable when
 * the build flag is set, and is dropped from production bundles.
 */
export function getAuthProvider(): Promise<AuthProvider> {
  provider ??= import.meta.env.VITE_GAMI_DEV_MOCK === 'true'
    ? import('./devAuth').then((m) => m.devAuth)
    : import('./privy').then((m) => m.privyAuth);
  return provider;
}

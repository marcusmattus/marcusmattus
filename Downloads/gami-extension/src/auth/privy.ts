import Privy, { LocalStorage } from '@privy-io/js-sdk-core';
import { config } from '../shared/config';
import { GamiError } from '../shared/errors';
import type { SessionRecord } from '../shared/types';
import { jwtExpiryMs, type AuthProvider } from './session';

/**
 * Privy email sign up / sign in with a one-time code, using Privy's headless
 * core SDK (no hosted UI, no remote scripts, no embedded-wallet iframe).
 * Runs in the popup and side panel only: the SDK keeps its tokens in the
 * extension origin's localStorage, which a service worker does not have.
 * The extension never sees or stores a wallet private key.
 */
let client: Privy | null = null;
let ready: Promise<void> | null = null;

async function privy(): Promise<Privy> {
  if (!config.privyAppId) throw new GamiError('not_configured', 'VITE_PRIVY_APP_ID is not set.');
  client ??= new Privy({
    appId: config.privyAppId,
    ...(config.privyClientId ? { clientId: config.privyClientId } : {}),
    storage: new LocalStorage(),
  });
  ready ??= client.initialize();
  await ready;
  return client;
}

async function currentSession(p: Privy): Promise<SessionRecord | null> {
  const token = await p.getAccessToken();
  if (!token) return null;
  const expiresAt = jwtExpiryMs(token);
  if (expiresAt === null || expiresAt <= Date.now()) return null;
  return { token, expiresAt };
}

function wrap(e: unknown, fallback: string): GamiError {
  if (e instanceof GamiError) return e;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new GamiError('offline', 'You are offline.');
  return new GamiError('unknown', e instanceof Error && e.message ? e.message.slice(0, 160) : fallback);
}

export const privyAuth: AuthProvider = {
  name: 'privy',
  async sendCode(email) {
    try { await (await privy()).auth.email.sendCode(email); }
    catch (e) { throw wrap(e, 'Could not send the code.'); }
  },
  async verifyCode(email, code) {
    try {
      const p = await privy();
      await p.auth.email.loginWithCode(email, code, 'login-or-sign-up');
      const session = await currentSession(p);
      if (!session) throw new GamiError('unauthorized', 'Privy did not return a session.');
      return session;
    } catch (e) { throw wrap(e, 'That code did not work.'); }
  },
  async restore() {
    try { return await currentSession(await privy()); }
    catch (e) {
      if (e instanceof GamiError && e.code === 'not_configured') throw e;
      return null;
    }
  },
  async signOut() {
    try { await (await privy()).auth.logout(); } catch { /* local state is cleared by the caller regardless */ }
  },
};

import { z } from 'zod';
import { request } from '../api/client';
import type { SessionRecord } from '../shared/types';
import type { AuthProvider } from './session';

/** DEVELOPMENT ONLY. Talks to dev/mock-server.mjs. Never in production bundles. */
const KEY = 'gami:dev-session';
const Schema = z.object({ token: z.string(), expiresAt: z.number() });

export const devAuth: AuthProvider = {
  name: 'dev-mock',
  async sendCode(email) {
    await request('/dev/send-code', z.object({ ok: z.literal(true) }), { method: 'POST', body: { email } });
  },
  async verifyCode(email, code) {
    const session: SessionRecord = await request('/dev/login', Schema, { method: 'POST', body: { email, code } });
    localStorage.setItem(KEY, JSON.stringify(session));
    return session;
  },
  async restore() {
    const parsed = Schema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
    return parsed.success && parsed.data.expiresAt > Date.now() ? parsed.data : null;
  },
  async signOut() { localStorage.removeItem(KEY); },
};

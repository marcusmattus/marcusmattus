import { vi } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore plain JS dev module
import { startMock, sign } from '../../dev/mock-server.mjs';

export type Mock = {
  apiUrl: string; siteUrl: string; close: () => Promise<unknown>;
  db: { sessions: Map<string, { userId: string; expiresAt: number }>; users: Map<string, { xp: number }> };
};
export { sign };

export const EXT_ID = 'gamiextensionid';
export const EXT_ORIGIN = `chrome-extension://${EXT_ID}`;
export const UI_SENDER = { id: EXT_ID, url: `${EXT_ORIGIN}/popup.html` } as chrome.runtime.MessageSender;

export async function boot(opts: { confirmDelayMs?: number; sessionTtlMs?: number } = {}): Promise<Mock> {
  return (await startMock({ apiPort: 18787, sitePort: 18788, confirmDelayMs: opts.confirmDelayMs ?? 300, sessionTtlMs: opts.sessionTtlMs })) as Mock;
}

export type FakeTab = { id: number; url: string; injectable: boolean; detection?: unknown; toPage: unknown[] };

/** An in-memory stand-in for the chrome.* APIs the background worker uses. */
export function installChrome() {
  const session = new Map<string, unknown>();
  const local = new Map<string, unknown>();
  const tabs = new Map<number, FakeTab>();
  const area = (m: Map<string, unknown>) => ({
    get: async (keys?: string | string[]) => {
      const list = keys === undefined ? [...m.keys()] : Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((k) => m.has(k)).map((k) => [k, structuredClone(m.get(k))]));
    },
    set: async (items: Record<string, unknown>) => { for (const [k, v] of Object.entries(items)) m.set(k, structuredClone(v)); },
    remove: async (keys: string | string[]) => { for (const k of Array.isArray(keys) ? keys : [keys]) m.delete(k); },
  });
  const fake = {
    runtime: { id: EXT_ID, getURL: (p: string) => `${EXT_ORIGIN}/${p}` },
    storage: { session: area(session), local: area(local) },
    tabs: {
      get: async (id: number) => { const t = tabs.get(id); if (!t) throw new Error('No tab'); return { id, url: t.url }; },
      sendMessage: async (id: number, msg: { type: string }) => {
        const t = tabs.get(id);
        if (!t) throw new Error('No tab');
        if (msg.type === 'SITE_DETECTED') {
          if (t.detection !== undefined) return t.detection;
          // What the real content script does: read the page's Gami manifest.
          try {
            const res = await fetch(`${new URL(t.url).origin}/.well-known/gami.json`);
            return { enabledMeta: res.ok, manifestMeta: res.ok ? '/.well-known/gami.json' : null, manifest: res.ok ? await res.json() : null, manifestError: null };
          } catch { return { enabledMeta: false, manifestMeta: null, manifest: null, manifestError: null }; }
        }
        t.toPage.push(msg);
        return undefined;
      },
    },
    scripting: { executeScript: async ({ target }: { target: { tabId: number } }) => { if (!tabs.get(target.tabId)?.injectable) throw new Error('Cannot access contents of the page'); return []; } },
  };
  vi.stubGlobal('chrome', fake);
  return {
    session, local, tabs,
    addTab: (id: number, url: string, extra: Partial<FakeTab> = {}) => { const t: FakeTab = { id, url, injectable: true, toPage: [], ...extra }; tabs.set(id, t); return t; },
  };
}

/** Fresh module instances = a restarted service worker. Storage survives. */
export async function loadWorker() {
  vi.resetModules();
  const messages = await import('../../src/background/messages');
  const storage = await import('../../src/storage');
  return { route: messages.route, getState: storage.getState, getActivity: storage.getActivity, getConnections: storage.getConnections };
}

let n = 0;
export const rid = (): string => `req-${Date.now()}-${n++}`;

export async function devLogin(mock: Mock, email = 'tester@example.com'): Promise<{ token: string; expiresAt: number }> {
  const res = await fetch(`${mock.apiUrl}/dev/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code: '000000' }) });
  return (await res.json()) as { token: string; expiresAt: number };
}

/** What the partner page does on completion: ask its own backend to sign. */
export async function partnerProof(mock: Mock, questId: string, nonce: string) {
  const res = await fetch(`${mock.siteUrl}/api/gami/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questId, nonce }) });
  const proof = (await res.json()) as { eventId: string; timestamp: string; signature: string };
  return { source: 'gami-site', type: 'GAMI_QUEST_EVENT', questId, nonce, ...proof };
}

export async function until(check: () => Promise<boolean>, ms = 8000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await check()) return; await new Promise((r) => setTimeout(r, 50)); }
  throw new Error('timed out waiting for condition');
}

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { authorizeAgentTool } from '../src/permissions/scopes';
import type { GamiAgentCredential } from '../src/schemas/agent';
import { resolveManifestUrl, validateManifest } from '../src/schemas/manifest';
import { classifySender, ContentMessageSchema, PageQuestEventSchema, UiMessageSchema } from '../src/schemas/messages';
import { QuestSchema } from '../src/schemas/quest';
import { idempotencyKey } from '../src/schemas/evidence';
import { discoverWebMcpTools } from '../src/webmcp/discover';
import { boot, devLogin, EXT_ID, EXT_ORIGIN, installChrome, loadWorker, partnerProof, rid, sign, UI_SENDER, until, type Mock } from './helpers/env';

const QUEST = 'quest_test_action';
const good = { version: '1', partnerId: 'partner_123', siteName: 'Example', domains: ['example.com'], quests: { endpoint: 'https://example.com/api/gami/quests' }, capabilities: ['quest.discovery'] };

describe('site manifest validation', () => {
  it('accepts a valid manifest for its own domain', () => {
    expect(validateManifest(good, 'https://example.com').ok).toBe(true);
  });
  it('rejects a manifest served by a domain it does not list (fake / copied manifest)', () => {
    expect(validateManifest(good, 'https://evil.test')).toMatchObject({ ok: false });
  });
  it('rejects endpoints on another origin', () => {
    expect(validateManifest({ ...good, quests: { endpoint: 'https://evil.test/q' } }, 'https://example.com')).toMatchObject({ ok: false });
  });
  it.each(['javascript:alert(1)', 'data:text/html,x', 'http://example.com/q', 'file:///etc/passwd'])('rejects endpoint %s', (endpoint) => {
    expect(validateManifest({ ...good, mcp: { endpoint } }, 'https://example.com').ok).toBe(false);
  });
  it('rejects malformed manifests and invalid partner IDs', () => {
    for (const bad of [null, 'x', {}, { ...good, version: '2' }, { ...good, partnerId: '<script>' }, { ...good, partnerId: '' }, { ...good, domains: [] }]) {
      expect(validateManifest(bad, 'https://example.com').ok).toBe(false);
    }
  });
  it('rejects insecure pages except localhost', () => {
    expect(validateManifest(good, 'http://example.com').ok).toBe(false);
    expect(validateManifest({ ...good, domains: ['localhost'], quests: undefined }, 'http://localhost:8788').ok).toBe(true);
  });
  it('only resolves same-origin manifest paths', () => {
    expect(resolveManifestUrl('/.well-known/gami.json', 'https://example.com')).toBe('https://example.com/.well-known/gami.json');
    expect(resolveManifestUrl(null, 'https://example.com')).toBe('https://example.com/.well-known/gami.json');
    for (const bad of ['https://evil.test/gami.json', '//evil.test/gami.json', 'javascript:alert(1)', '/\\evil.test']) {
      expect(resolveManifestUrl(bad, 'https://example.com')).toBeNull();
    }
  });
});

describe('message validation', () => {
  const ev = { source: 'gami-site', type: 'GAMI_QUEST_EVENT', questId: 'q', eventId: 'e', nonce: 'n'.repeat(16), timestamp: new Date().toISOString(), signature: 'a'.repeat(64) };
  it('accepts only exact quest events from the page', () => {
    expect(PageQuestEventSchema.safeParse(ev).success).toBe(true);
    for (const bad of [{ ...ev, source: 'other' }, { ...ev, type: 'GAMI_REWARD' }, { ...ev, extra: 1 }, { ...ev, signature: 'zz' }, { ...ev, nonce: 'short' }, { ...ev, timestamp: 'yesterday' }, null, 'GAMI_QUEST_EVENT']) {
      expect(PageQuestEventSchema.safeParse(bad).success).toBe(false);
    }
  });
  it('a tab can only send QUEST_COMPLETED: no UI command is valid from content', () => {
    expect(ContentMessageSchema.safeParse({ requestId: 'r'.repeat(8), type: 'QUEST_COMPLETED', event: ev }).success).toBe(true);
    for (const type of ['AUTH_STATUS', 'SCAN_SITE', 'QUEST_STARTED', 'CONNECTION_REQUEST', 'NOVA_REQUEST', 'NOVA_RESPONSE']) {
      expect(ContentMessageSchema.safeParse({ requestId: 'r'.repeat(8), type, questId: 'q', approve: true, origin: 'https://a.b', text: 'x' }).success).toBe(false);
    }
    expect(UiMessageSchema.safeParse({ requestId: 'r'.repeat(8), type: 'QUEST_COMPLETED', event: ev }).success).toBe(false);
  });
  it('classifies senders: other extensions and odd origins are rejected', () => {
    expect(classifySender({ id: EXT_ID, url: `${EXT_ORIGIN}/popup.html` }, EXT_ID, EXT_ORIGIN)).toBe('ui');
    expect(classifySender({ id: EXT_ID, url: 'https://example.com/', tabId: 1 }, EXT_ID, EXT_ORIGIN)).toBe('content');
    expect(classifySender({ id: 'another-extension', url: `${EXT_ORIGIN}/popup.html` }, EXT_ID, EXT_ORIGIN)).toBe('reject');
    expect(classifySender({ id: EXT_ID, url: `${EXT_ORIGIN}.evil.test/popup.html` }, EXT_ID, EXT_ORIGIN)).toBe('reject');
    expect(classifySender({ id: EXT_ID, url: 'https://example.com/' }, EXT_ID, EXT_ORIGIN)).toBe('reject');
    expect(classifySender({ url: 'https://example.com/', tabId: 1 }, EXT_ID, EXT_ORIGIN)).toBe('reject');
  });
  it('rejects malformed quests from the API', () => {
    expect(QuestSchema.safeParse({ id: 'q', title: 'x' }).success).toBe(false);
    expect(QuestSchema.safeParse({ id: 'q', creatorId: 'c', title: 't', description: '', category: 'c', status: 'active', requirements: [], verification: { type: 'server_proof', label: 'x' }, reward: { type: 'XP', amount: '1e9' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).success).toBe(false);
  });
});

describe('NOVA authorization', () => {
  const cred: GamiAgentCredential = { agentId: 'nova', userId: 'u1', walletAddress: '0x0', scopes: ['quests:read', 'quests:start', 'xp:read'], expiresAt: new Date(Date.now() + 60_000).toISOString(), sessionId: 's', token: 't' };
  const o = { now: Date.now(), userId: 'u1' };
  it('allows scoped quest tools and requires confirmation to start', () => {
    expect(authorizeAgentTool(cred, 'gami.quests.list', o)).toMatchObject({ ok: true, requiresConfirmation: false });
    expect(authorizeAgentTool(cred, 'gami.quests.start', o)).toMatchObject({ ok: true, requiresConfirmation: true });
  });
  it.each(['gami.wallet.transfer', 'gami.wallet.export', 'gami.transactions.sign', 'gami.treasury.spend', 'gami.admin.anything', 'constructor', '__proto__', 'toString', ''])('denies unauthorized tool %s', (tool) => {
    expect(authorizeAgentTool({ ...cred, scopes: [...cred.scopes, 'funds:transfer', 'wallet:export', 'transactions:sign', 'admin:*'] }, tool, o).ok).toBe(false);
  });
  it('denies a missing scope, an expired credential, no credential, another user, and out-of-scope quests', () => {
    expect(authorizeAgentTool(cred, 'gami.points.get', o).ok).toBe(false);
    expect(authorizeAgentTool({ ...cred, expiresAt: new Date(o.now - 1000).toISOString() }, 'gami.quests.list', o).ok).toBe(false);
    expect(authorizeAgentTool(null, 'gami.quests.list', o).ok).toBe(false);
    expect(authorizeAgentTool(cred, 'gami.quests.list', { ...o, userId: 'u2' }).ok).toBe(false);
    expect(authorizeAgentTool({ ...cred, questIds: ['a'] }, 'gami.quests.start', { ...o, questId: 'b' }).ok).toBe(false);
  });
});

describe('WebMCP discovery', () => {
  it('drops forged or malformed tools and never allows transaction or sensitive ones', () => {
    const tools = discoverWebMcpTools([
      { name: 'content.view', description: 'd', inputSchema: {}, riskLevel: 'read', requiresConfirmation: false },
      { name: 'wallet.drain', description: 'd', inputSchema: {}, riskLevel: 'transaction', requiresConfirmation: false },
      { name: 'account.delete', description: 'd', inputSchema: {}, riskLevel: 'sensitive', requiresConfirmation: false },
      { name: 'event.register', description: 'd', inputSchema: {}, riskLevel: 'interaction', requiresConfirmation: false },
      { name: 'Bad Name!', description: 'd', inputSchema: {}, riskLevel: 'read', requiresConfirmation: false },
      { name: 'x.y', description: 'd', inputSchema: {}, riskLevel: 'harmless', requiresConfirmation: false },
      'not a tool',
    ]);
    expect(tools.map((t) => [t.name, t.allowed])).toEqual([['content.view', true], ['wallet.drain', false], ['account.delete', false], ['event.register', true]]);
    expect(tools.find((t) => t.name === 'event.register')!.requiresConfirmation).toBe(true);
    expect(discoverWebMcpTools('nope')).toEqual([]);
  });
});

describe('end to end against the mock backend', () => {
  let mock: Mock;
  let env: ReturnType<typeof installChrome>;
  let w: Awaited<ReturnType<typeof loadWorker>>;
  const content = (tabId: number, url: string) => ({ id: EXT_ID, url, tab: { id: tabId }, frameId: 0 }) as chrome.runtime.MessageSender;

  beforeAll(async () => { mock = await boot(); });
  afterAll(async () => { await mock.close(); });
  beforeEach(async () => { env = installChrome(); w = await loadWorker(); });

  async function ready() {
    const session = await devLogin(mock, `s${Date.now()}${Math.random()}@example.com`);
    await w.route({ requestId: rid(), type: 'AUTH_STATUS', session }, UI_SENDER);
    env.addTab(1, `${mock.siteUrl}/`);
    await w.route({ requestId: rid(), type: 'SCAN_SITE', tabId: 1 }, UI_SENDER);
    await w.route({ requestId: rid(), type: 'QUEST_STARTED', questId: QUEST }, UI_SENDER);
    await w.route({ requestId: rid(), type: 'CONNECTION_REQUEST', origin: mock.siteUrl, approve: true }, UI_SENDER);
    return { session, nonce: (await w.getState()).active[QUEST]!.nonce };
  }

  it('ignores UI commands sent from a web page tab', async () => {
    const session = await devLogin(mock);
    const r = await w.route({ requestId: rid(), type: 'AUTH_STATUS', session }, content(9, 'https://evil.test/'));
    expect(r.ok).toBe(false);
    expect((await w.getState()).auth.status).toBe('signed_out');
  });

  it('rejects messages from another extension and from sub-frames', async () => {
    expect((await w.route({ requestId: rid(), type: 'REFRESH' }, { id: 'other', url: `${EXT_ORIGIN}/popup.html` } as chrome.runtime.MessageSender)).ok).toBe(false);
    const { nonce } = await ready();
    const event = await partnerProof(mock, QUEST, nonce);
    const r = await w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event }, { ...content(1, `${mock.siteUrl}/`), frameId: 3 });
    expect(r.ok).toBe(false);
    expect((await w.getState()).active[QUEST]!.status).toBe('started');
  });

  it('rejects a completion from a different tab or a spoofed origin', async () => {
    const { nonce } = await ready();
    const event = await partnerProof(mock, QUEST, nonce);
    expect((await w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event }, content(2, `${mock.siteUrl}/`))).ok).toBe(false);
    expect((await w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event }, content(1, 'https://evil.test/'))).ok).toBe(false);
    expect((await w.getState()).active[QUEST]!.status).toBe('started');
  });

  it('rejects a completion for a quest that was never started, and an invalid nonce', async () => {
    const { nonce } = await ready();
    const other = { ...(await partnerProof(mock, 'quest_other', nonce)) };
    expect((await w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event: other }, content(1, `${mock.siteUrl}/`))).ok).toBe(false);
    const wrong = await partnerProof(mock, QUEST, 'f'.repeat(48));
    expect((await w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event: wrong }, content(1, `${mock.siteUrl}/`))).ok).toBe(false);
    expect((await w.getState()).active[QUEST]!.status).toBe('started');
  });

  it('a page cannot forge a reward: a self-signed event is rejected by the server', async () => {
    const { nonce } = await ready();
    const timestamp = new Date().toISOString();
    const event = { source: 'gami-site', type: 'GAMI_QUEST_EVENT', questId: QUEST, eventId: 'evt_forged', nonce, timestamp, signature: sign(QUEST, mock.siteUrl, 'evt_forged', nonce, timestamp, 'attacker-guess') };
    await w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event }, content(1, `${mock.siteUrl}/`));
    const s = await w.getState();
    expect(s.active[QUEST]!.status).toBe('rejected');
    expect(s.balances?.xp).toBe(1250);
  });

  it('awards once when the completion is replayed, duplicated and retried', async () => {
    const { session, nonce } = await ready();
    const event = await partnerProof(mock, QUEST, nonce);
    const sender = content(1, `${mock.siteUrl}/`);
    const sameId = rid();
    const results = await Promise.all([
      w.route({ requestId: sameId, type: 'QUEST_COMPLETED', event }, sender),
      w.route({ requestId: sameId, type: 'QUEST_COMPLETED', event }, sender), // duplicate delivery
      w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event }, sender), // replay
      w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event }, sender),
    ]);
    expect(results.filter((r) => r.ok && true).length).toBeGreaterThanOrEqual(1);
    await until(async () => (await w.getState()).active[QUEST]!.status === 'confirmed');
    // Replay after confirmation, and a direct duplicate API submit with the same idempotency key.
    expect((await w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event }, sender)).ok).toBe(false);
    const st = await w.getState();
    const a = st.active[QUEST]!;
    const dup = await fetch(`${mock.apiUrl}/quests/${QUEST}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'Idempotency-Key': idempotencyKey(QUEST, st.identity!.id, a.startId) },
      body: JSON.stringify({ startId: a.startId, evidence: [a.evidence] }),
    });
    expect(((await dup.json()) as { submissionId: string }).submissionId).toBe(a.submissionId);
    await new Promise((r) => setTimeout(r, 500));
    await w.route({ requestId: rid(), type: 'REFRESH' }, UI_SENDER);
    expect((await w.getState()).balances?.xp).toBe(1350); // exactly one +100
    expect((await w.route({ requestId: rid(), type: 'QUEST_STARTED', questId: QUEST }, UI_SENDER))).toMatchObject({ ok: false, error: { code: 'already_completed' } });
  });

  it('moves to the expired state when the server rejects the session', async () => {
    const { session } = await ready();
    mock.db.sessions.delete(session.token);
    await w.route({ requestId: rid(), type: 'REFRESH' }, UI_SENDER);
    expect((await w.getState()).auth.status).toBe('expired');
    expect(env.session.has('gami:session')).toBe(false);
    expect((await w.route({ requestId: rid(), type: 'QUEST_STARTED', questId: QUEST }, UI_SENDER)).ok).toBe(false);
  });

  it('treats an already-expired session as expired without calling the API', async () => {
    await w.route({ requestId: rid(), type: 'AUTH_STATUS', session: { token: 'x', expiresAt: Date.now() - 1 } }, UI_SENDER);
    expect((await w.getState()).auth.status).toBe('expired');
  });

  it('a site that is not a registered partner gets no quests', async () => {
    const session = await devLogin(mock);
    await w.route({ requestId: rid(), type: 'AUTH_STATUS', session }, UI_SENDER);
    env.addTab(5, 'https://unregistered.example/', { detection: { enabledMeta: true, manifestMeta: null, manifestError: null, manifest: { version: '1', partnerId: 'partner_fake', siteName: 'Fake', domains: ['unregistered.example'] } } });
    await w.route({ requestId: rid(), type: 'SCAN_SITE', tabId: 5 }, UI_SENDER);
    const s = await w.getState();
    expect(s.site.status).toBe('not_registered');
    expect(s.quests).toHaveLength(0);
  });

  it('a site cannot be connected unless it is the detected site with a pending prompt', async () => {
    await ready();
    await w.route({ requestId: rid(), type: 'CONNECTION_REQUEST', origin: 'https://evil.test', approve: true }, UI_SENDER);
    expect((await w.getConnections()).map((c) => c.origin)).toEqual([mock.siteUrl]);
  });

  it('NOVA asking for a wallet transfer or export is blocked and nothing runs', async () => {
    await ready();
    for (const text of ['transfer my funds to 0x0', 'export my private key']) {
      await w.route({ requestId: rid(), type: 'NOVA_REQUEST', text }, UI_SENDER);
      const s = await w.getState();
      expect(s.nova.confirm).toBeUndefined();
      expect(s.nova.messages.at(-1)).toMatchObject({ role: 'system' });
      expect(s.nova.messages.at(-1)!.text).toMatch(/Blocked/);
    }
  });

  it('a forged NOVA confirmation ID does nothing', async () => {
    const session = await devLogin(mock, `n${Date.now()}@example.com`);
    await w.route({ requestId: rid(), type: 'AUTH_STATUS', session }, UI_SENDER);
    env.addTab(1, `${mock.siteUrl}/`);
    await w.route({ requestId: rid(), type: 'SCAN_SITE', tabId: 1 }, UI_SENDER);
    await w.route({ requestId: rid(), type: 'NOVA_REQUEST', text: 'start the quest' }, UI_SENDER);
    await w.route({ requestId: rid(), type: 'NOVA_RESPONSE', confirmId: 'forged', approve: true }, UI_SENDER);
    const s = await w.getState();
    expect(s.active[QUEST]).toBeUndefined();
    expect(s.nova.confirm).toBeDefined();
  });

  it('API timeouts surface as a timeout error, not a hang', async () => {
    const { request } = await import('../src/api/client');
    const { z } = await import('zod');
    await expect(request('/dev/slow', z.object({ ok: z.boolean() }), { timeoutMs: 200 })).rejects.toMatchObject({ code: 'timeout' });
  });

  it('an unreachable API surfaces as unavailable', async () => {
    const { request } = await import('../src/api/client');
    const { z } = await import('zod');
    await expect(request('/x', z.object({}), { baseUrl: 'http://127.0.0.1:9' })).rejects.toMatchObject({ code: 'api_unavailable' });
  });

  it('refuses non-HTTPS service URLs', async () => {
    const { request } = await import('../src/api/client');
    const { z } = await import('zod');
    await expect(request('/x', z.object({}), { baseUrl: 'http://api.example.com' })).rejects.toMatchObject({ code: 'not_configured' });
  });
});

describe('manifest and storage hygiene', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as Record<string, unknown>;
  it('requests exactly the four intended permissions and no host access', () => {
    expect(manifest.permissions).toEqual(['storage', 'activeTab', 'scripting', 'sidePanel']);
    for (const k of ['host_permissions', 'content_scripts', 'externally_connectable', 'web_accessible_resources']) expect(manifest[k]).toBeUndefined();
    expect(JSON.stringify(manifest)).not.toContain('<all_urls>');
  });
  it('the worker stores only the access token and its expiry in session storage, nothing key-like in local storage', async () => {
    const mock = await boot();
    try {
      const env = installChrome();
      const w = await loadWorker();
      await w.route({ requestId: rid(), type: 'AUTH_STATUS', session: await devLogin(mock) }, UI_SENDER);
      expect(Object.keys(env.session.get('gami:session') as object).sort()).toEqual(['expiresAt', 'token']);
      expect(JSON.stringify([...env.local.entries()])).not.toMatch(/token|private|seed|secret/i);
    } finally { await mock.close(); }
  });
});

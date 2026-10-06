import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boot, devLogin, installChrome, loadWorker, partnerProof, rid, UI_SENDER, until, EXT_ID, type Mock } from './helpers/env';

const QUEST = 'quest_test_action';
let mock: Mock;
let env: ReturnType<typeof installChrome>;
let w: Awaited<ReturnType<typeof loadWorker>>;
const contentSender = (tabId: number, url: string) => ({ id: EXT_ID, url, tab: { id: tabId }, frameId: 0 }) as chrome.runtime.MessageSender;

beforeAll(async () => { mock = await boot(); });
afterAll(async () => { await mock.close(); });
beforeEach(async () => { env = installChrome(); w = await loadWorker(); });

async function signIn(email = `u${Date.now()}${Math.random()}@example.com`) {
  const session = await devLogin(mock, email);
  expect(await w.route({ requestId: rid(), type: 'AUTH_STATUS', session }, UI_SENDER)).toEqual({ ok: true });
  return session;
}
async function scan(tabId = 1, url = `${mock.siteUrl}/`) {
  env.addTab(tabId, url);
  await w.route({ requestId: rid(), type: 'SCAN_SITE', tabId }, UI_SENDER);
}
async function connectAndStart() {
  const first = await w.route({ requestId: rid(), type: 'QUEST_STARTED', questId: QUEST }, UI_SENDER);
  expect(first).toMatchObject({ ok: false, error: { code: 'permission_denied' } });
  expect((await w.getState()).pendingConnection?.origin).toBe(mock.siteUrl);
  expect(await w.route({ requestId: rid(), type: 'CONNECTION_REQUEST', origin: mock.siteUrl, approve: true }, UI_SENDER)).toEqual({ ok: true });
}

describe('identity', () => {
  it('signs in and loads identity, wallet address, XP, level and Universal Points', async () => {
    await signIn();
    const s = await w.getState();
    expect(s.auth.status).toBe('signed_in');
    expect(s.identity?.walletAddress).toMatch(/^0x[0-9a-f]{40}$/);
    expect(s.identity?.network).toBe('gami-1');
    expect(s.balances).toMatchObject({ xp: 1250, level: 4, points: 820 });
  });

  it('restores the session after a service-worker restart without re-fetching identity state', async () => {
    const session = await signIn();
    w = await loadWorker();
    await w.route({ requestId: rid(), type: 'AUTH_STATUS', session }, UI_SENDER);
    expect((await w.getState()).auth.status).toBe('signed_in');
  });

  it('signs out and clears user state and the stored token', async () => {
    await signIn();
    await w.route({ requestId: rid(), type: 'AUTH_STATUS', session: null }, UI_SENDER);
    const s = await w.getState();
    expect(s.auth.status).toBe('signed_out');
    expect(s.identity).toBeUndefined();
    expect(env.session.has('gami:session')).toBe(false);
  });
});

describe('site detection', () => {
  it('detects the Gami test site, validates its manifest and loads its quest', async () => {
    await signIn();
    await scan();
    const s = await w.getState();
    expect(s.site).toMatchObject({ status: 'supported', siteName: 'Gami Test Site', partnerId: 'partner_test', origin: mock.siteUrl });
    expect(s.quests).toHaveLength(1);
    expect(s.quests[0]).toMatchObject({ title: 'Complete Test Quest', reward: { type: 'XP', amount: '100' } });
  });

  it('reports a site with no Gami metadata as unsupported', async () => {
    await signIn();
    env.addTab(2, 'https://example.org/', { detection: { enabledMeta: false, manifestMeta: null, manifest: null, manifestError: null } });
    await w.route({ requestId: rid(), type: 'SCAN_SITE', tabId: 2 }, UI_SENDER);
    expect((await w.getState()).site.status).toBe('unsupported');
  });

  it('reports pages it cannot run on, and tabs without an activeTab grant, as restricted', async () => {
    env.addTab(3, 'chrome://settings/');
    await w.route({ requestId: rid(), type: 'SCAN_SITE', tabId: 3 }, UI_SENDER);
    expect((await w.getState()).site.status).toBe('restricted');
    env.addTab(4, 'https://example.org/', { injectable: false });
    await w.route({ requestId: rid(), type: 'SCAN_SITE', tabId: 4 }, UI_SENDER);
    expect((await w.getState()).site.status).toBe('restricted');
  });

  it('lists declared WebMCP tools and blocks transaction tools', async () => {
    await signIn();
    await scan();
    const tools = (await w.getState()).site.tools ?? [];
    expect(tools.find((t) => t.name === 'quest.complete')?.allowed).toBe(true);
    expect(tools.find((t) => t.name === 'checkout.pay')?.allowed).toBe(false);
  });
});

describe('quest lifecycle', () => {
  it('runs the full slice: connect, start, complete, pending, confirmed, +100 XP', async () => {
    await signIn();
    await scan();
    await connectAndStart();
    let s = await w.getState();
    const active = s.active[QUEST]!;
    expect(active.status).toBe('started');
    expect(env.tabs.get(1)!.toPage).toContainEqual({ type: 'QUEST_PROGRESS', questId: QUEST, nonce: active.nonce });
    expect((await w.getConnections())[0]).toMatchObject({ origin: mock.siteUrl, permissions: ['quests:read', 'quests:start', 'quests:submit'] });

    const event = await partnerProof(mock, QUEST, active.nonce);
    const done = w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event }, contentSender(1, `${mock.siteUrl}/`));
    await until(async () => ['pending', 'reward_pending'].includes((await w.getState()).active[QUEST]!.status));
    expect((await w.getState()).balances?.xp).toBe(1250); // not credited before confirmation
    expect(await done).toEqual({ ok: true });
    s = await w.getState();
    expect(s.active[QUEST]!.status).toBe('confirmed');
    expect(s.balances?.xp).toBe(1350);
    expect((await w.getActivity()).map((a) => a.kind)).toEqual(expect.arrayContaining(['site_connected', 'quest_started', 'quest_submitted', 'reward_confirmed']));
  });

  it('shows a rejected verification when the partner signature is wrong', async () => {
    await signIn();
    await scan();
    await connectAndStart();
    const nonce = (await w.getState()).active[QUEST]!.nonce;
    const event = { ...(await partnerProof(mock, QUEST, nonce)), signature: 'a'.repeat(64) };
    await w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event }, contentSender(1, `${mock.siteUrl}/`));
    const s = await w.getState();
    expect(s.active[QUEST]!.status).toBe('rejected');
    expect(s.balances?.xp).toBe(1250);
  });

  it('declining the connection prompt starts nothing', async () => {
    await signIn();
    await scan();
    await w.route({ requestId: rid(), type: 'QUEST_STARTED', questId: QUEST }, UI_SENDER);
    await w.route({ requestId: rid(), type: 'CONNECTION_REQUEST', origin: mock.siteUrl, approve: false }, UI_SENDER);
    expect((await w.getState()).active[QUEST]).toBeUndefined();
    expect(await w.getConnections()).toHaveLength(0);
  });

  it('disconnecting a site revokes its permission', async () => {
    await signIn();
    await scan();
    await connectAndStart();
    await w.route({ requestId: rid(), type: 'CONNECTION_UPDATED', origin: mock.siteUrl, action: 'disconnect' }, UI_SENDER);
    expect(await w.getConnections()).toHaveLength(0);
  });

  it('resumes a pending reward after a service-worker restart', async () => {
    const session = await signIn();
    await scan();
    await connectAndStart();
    const nonce = (await w.getState()).active[QUEST]!.nonce;
    const event = await partnerProof(mock, QUEST, nonce);
    void w.route({ requestId: rid(), type: 'QUEST_COMPLETED', event }, contentSender(1, `${mock.siteUrl}/`));
    await until(async () => (await w.getState()).active[QUEST]!.intentId !== undefined);
    w = await loadWorker(); // worker killed mid-poll
    await w.route({ requestId: rid(), type: 'AUTH_STATUS', session }, UI_SENDER);
    await until(async () => (await w.getState()).active[QUEST]!.status === 'confirmed');
    expect((await w.getState()).balances?.xp).toBe(1350);
  });
});

describe('NOVA', () => {
  it('explains quests from structured context and never receives page content', async () => {
    await signIn();
    await scan();
    await w.route({ requestId: rid(), type: 'NOVA_REQUEST', text: 'What can I earn here?' }, UI_SENDER);
    const s = await w.getState();
    expect(s.nova.load).toBe('ready');
    expect(s.nova.messages.at(-1)).toMatchObject({ role: 'nova' });
    expect(s.nova.messages.at(-1)!.text).toContain('Complete Test Quest');
    const { buildNovaContext } = await import('../src/background/nova');
    expect(Object.keys(buildNovaContext(s)).sort()).toEqual(['activeQuests', 'capabilities', 'level', 'nextLevelXp', 'origin', 'points', 'quests', 'siteName', 'xp']);
  });

  it('starts a quest only after the user confirms', async () => {
    await signIn();
    await scan();
    await w.route({ requestId: rid(), type: 'QUEST_STARTED', questId: QUEST }, UI_SENDER);
    await w.route({ requestId: rid(), type: 'CONNECTION_REQUEST', origin: mock.siteUrl, approve: false }, UI_SENDER);
    await w.route({ requestId: rid(), type: 'NOVA_REQUEST', text: 'Start this quest' }, UI_SENDER);
    let s = await w.getState();
    expect(s.nova.confirm).toMatchObject({ tool: 'gami.quests.start', questId: QUEST });
    expect(s.active[QUEST]).toBeUndefined();
    await w.route({ requestId: rid(), type: 'NOVA_RESPONSE', confirmId: s.nova.confirm!.confirmId, approve: false }, UI_SENDER);
    s = await w.getState();
    expect(s.nova.confirm).toBeUndefined();
    expect(s.active[QUEST]).toBeUndefined();
  });
});

describe('NOVA wallet access', () => {
  const userOf = (token: string) => mock.db.users.get(mock.db.sessions.get(token)!.userId)!;

  it('shows no access until it is granted in the wallet app, then the scoped grant', async () => {
    const session = await signIn();
    let s = await w.getState();
    expect(s.agentWalletLoad).toBe('ready');
    expect(s.agentWallet).toMatchObject({ configured: true, wallet: { address: s.identity!.walletAddress, grant: 'none' } });
    userOf(session.token).novaGrant = 'scoped';
    await w.route({ requestId: rid(), type: 'REFRESH' }, UI_SENDER);
    s = await w.getState();
    expect(s.agentWallet?.wallet?.grant).toBe('scoped');
  });

  it('is cleared when the user signs out', async () => {
    await signIn();
    expect((await w.getState()).agentWallet).toBeDefined();
    await w.route({ requestId: rid(), type: 'AUTH_STATUS', session: null }, UI_SENDER);
    const s = await w.getState();
    expect(s.agentWallet).toBeUndefined();
    expect(s.agentWalletLoad).toBe('idle');
  });
});

// DEVELOPMENT ONLY. A mock Gami API (and NOVA) plus the example partner site.
// Nothing in this file ships in the extension package.
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples', 'gami-test-site');
const PARTNER_ID = 'partner_test';
const PARTNER_SECRET = 'dev-partner-secret-not-for-production';
const SAFE_SCOPES = ['profile:read', 'wallet:read', 'xp:read', 'points:read', 'rewards:read', 'quests:read', 'quests:start', 'quests:submit', 'nova:use'];
const DEV_CODE = '000000';

export function sign(questId, origin, eventId, nonce, timestamp, secret = PARTNER_SECRET) {
  return createHmac('sha256', secret).update([questId, origin, eventId, nonce, timestamp].join('|')).digest('hex');
}

function quest(now) {
  return {
    id: 'quest_test_action', creatorId: PARTNER_ID, campaignId: 'campaign_test',
    title: 'Complete Test Quest', description: 'Complete the test action on this page.', category: 'Button action',
    status: 'active',
    requirements: [{ type: 'BUTTON_ACTION', description: 'Press the test button' }],
    verification: { type: 'partner_signature', label: 'Server proof' },
    reward: { type: 'XP', amount: '100' },
    createdAt: now, updatedAt: now,
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

export async function startMock({ apiPort = 8787, sitePort = 8788, confirmDelayMs = 2000, sessionTtlMs = 3600_000 } = {}) {
  const created = new Date().toISOString();
  const db = { users: new Map(), sessions: new Map(), agents: new Map(), starts: new Map(), idem: new Map(), intents: new Map(), completed: new Set() };
  const siteOrigins = () => [`http://localhost:${site.address().port}`, `http://127.0.0.1:${site.address().port}`];

  const json = (res, status, body) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, idempotency-key',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end(JSON.stringify(body));
  };
  const userOf = (req) => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const s = db.sessions.get(token);
    return s && s.expiresAt > Date.now() ? db.users.get(s.userId) : null;
  };

  const api = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    if (req.method === 'OPTIONS') return json(res, 204, {});
    const body = req.method === 'POST' ? await readBody(req) : {};

    if (path === '/dev/slow') return void setTimeout(() => json(res, 200, { ok: true }), 3000);
    if (path === '/dev/send-code') return json(res, 200, { ok: true });
    if (path === '/dev/login') {
      if (typeof body.email !== 'string' || body.code !== DEV_CODE) return json(res, 403, { error: 'bad_code', message: `Wrong code. The development code is ${DEV_CODE}.` });
      let user = [...db.users.values()].find((u) => u.email === body.email);
      if (!user) {
        user = { id: `user_${randomUUID().slice(0, 8)}`, email: body.email, xp: 1250, points: 820, wallet: `0x${randomBytes(20).toString('hex')}` };
        db.users.set(user.id, user);
      }
      const token = `dev_${randomBytes(24).toString('hex')}`;
      const expiresAt = Date.now() + sessionTtlMs;
      db.sessions.set(token, { userId: user.id, expiresAt });
      return json(res, 200, { token, expiresAt });
    }

    if (path === '/nova/chat') {
      const agent = db.agents.get((req.headers.authorization ?? '').replace(/^Bearer /, ''));
      if (!agent || Date.parse(agent.expiresAt) < Date.now()) return json(res, 401, { error: 'unauthorized' });
      const text = String(body.text ?? '').toLowerCase();
      const ctx = body.context ?? {};
      const quests = Array.isArray(ctx.quests) ? ctx.quests : [];
      if (/transfer|send funds/.test(text)) return json(res, 200, { reply: 'I will move those funds.', toolRequest: { tool: 'gami.wallet.transfer', args: { to: '0x0', amount: '1' } } });
      if (/export|private key|seed/.test(text)) return json(res, 200, { reply: 'Exporting the wallet.', toolRequest: { tool: 'gami.wallet.export', args: {} } });
      if (/start/.test(text) && quests[0]) return json(res, 200, { reply: `I can start "${quests[0].title}" for you. Confirm below.`, toolRequest: { tool: 'gami.quests.start', args: { questId: quests[0].id } } });
      if (/level|xp|close/.test(text)) return json(res, 200, { reply: `You have ${ctx.xp} XP at level ${ctx.level}. ${ctx.nextLevelXp ? `${ctx.nextLevelXp - ctx.xp} XP to the next level.` : ''}` });
      if (/confirm|reward/.test(text)) {
        const a = Array.isArray(ctx.activeQuests) ? ctx.activeQuests : [];
        return json(res, 200, { reply: a.length ? a.map((q) => `${q.questId}: ${q.status}`).join('\n') : 'You have no quest rewards in progress.' });
      }
      if (!quests.length) return json(res, 200, { reply: 'There are no Gami quests on this site.' });
      return json(res, 200, { reply: `${ctx.siteName} has ${quests.length} quest(s):\n${quests.map((q) => `${q.title}: ${q.reward}. ${q.description}`).join('\n')}` });
    }

    if (path === '/quests' && req.method === 'GET') {
      const origin = url.searchParams.get('origin');
      if (url.searchParams.get('partnerId') !== PARTNER_ID || !siteOrigins().includes(origin)) return json(res, 403, { error: 'partner_not_registered', message: 'Partner is not registered for this origin.' });
      return json(res, 200, { quests: [quest(created)] });
    }

    const user = userOf(req);
    if (!user) return json(res, 401, { error: 'unauthorized' });

    if (path === '/identity') return json(res, 200, { id: user.id, privyUserId: `did:privy:dev-${user.id}`, walletAddress: user.wallet, network: 'gami-1' });
    if (path === '/xp') return json(res, 200, { xp: user.xp, level: 4, nextLevelXp: 2000 });
    if (path === '/points') return json(res, 200, { points: user.points });
    if (path === '/agent/credential') {
      const scopes = (Array.isArray(body.scopes) ? body.scopes : []).filter((s) => SAFE_SCOPES.includes(s));
      const cred = { agentId: 'nova', userId: user.id, walletAddress: user.wallet, scopes, expiresAt: new Date(Date.now() + 600_000).toISOString(), sessionId: randomUUID(), token: `agent_${randomBytes(24).toString('hex')}` };
      db.agents.set(cred.token, cred);
      return json(res, 200, cred);
    }

    let m;
    if ((m = path.match(/^\/quests\/([^/]+)$/)) && req.method === 'GET') {
      return m[1] === 'quest_test_action' ? json(res, 200, quest(created)) : json(res, 404, { error: 'not_found' });
    }
    if ((m = path.match(/^\/quests\/([^/]+)\/start$/)) && req.method === 'POST') {
      if (m[1] !== 'quest_test_action') return json(res, 404, { error: 'quest_unavailable' });
      if (!siteOrigins().includes(body.origin)) return json(res, 403, { error: 'partner_not_registered' });
      if (db.completed.has(`${user.id}:${m[1]}`)) return json(res, 409, { error: 'already_completed', message: 'You already completed this quest.' });
      const start = { startId: `start_${randomUUID()}`, nonce: randomBytes(24).toString('hex'), expiresAt: new Date(Date.now() + 900_000).toISOString() };
      db.starts.set(start.startId, { ...start, userId: user.id, questId: m[1], origin: body.origin, used: false });
      return json(res, 200, start);
    }
    if ((m = path.match(/^\/quests\/([^/]+)\/submit$/)) && req.method === 'POST') {
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || !key) return json(res, 400, { error: 'idempotency_key_required' });
      if (db.idem.has(key)) return json(res, 200, db.idem.get(key)); // same completion: same answer, no second reward
      const start = db.starts.get(body.startId);
      const ev = Array.isArray(body.evidence) ? body.evidence[0] : null;
      const submissionId = `sub_${randomUUID()}`;
      const rejectWith = (reason) => { const r = { submissionId, questId: m[1], status: 'rejected', reason }; db.idem.set(key, r); return json(res, 200, r); };
      if (!start || start.userId !== user.id || start.questId !== m[1]) return rejectWith('Quest was not started by this user.');
      if (key !== `${m[1]}:${user.id}:${start.startId}`) return rejectWith('Idempotency key does not match.');
      if (!ev || ev.questId !== m[1]) return rejectWith('Evidence is for another quest.');
      if (ev.origin !== start.origin) return rejectWith('Evidence came from another origin.');
      if (start.used || ev.nonce !== start.nonce) return rejectWith('Nonce is invalid or already used.');
      if (Math.abs(Date.now() - Date.parse(ev.timestamp)) > 300_000) return rejectWith('Evidence is too old.');
      const expected = Buffer.from(sign(ev.questId, ev.origin, ev.eventId, ev.nonce, ev.timestamp));
      const given = Buffer.from(String(ev.signature));
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return rejectWith('Partner signature is invalid.');
      if (db.completed.has(`${user.id}:${m[1]}`)) return rejectWith('Quest already completed.');
      start.used = true;
      db.completed.add(`${user.id}:${m[1]}`);
      const intent = { intentId: `intent_${randomUUID()}`, userId: user.id, walletAddress: user.wallet, questId: m[1], campaignId: 'campaign_test', eventId: ev.eventId, reward: { type: 'XP', amount: '100' }, status: 'pending' };
      db.intents.set(intent.intentId, intent);
      setTimeout(() => { intent.status = 'approved'; }, confirmDelayMs / 2);
      setTimeout(() => { intent.status = 'confirmed'; user.xp += 100; }, confirmDelayMs);
      const result = { submissionId, questId: m[1], status: 'pending', rewardIntentId: intent.intentId };
      db.idem.set(key, result);
      return json(res, 200, result);
    }
    if ((m = path.match(/^\/rewards\/([^/]+)$/))) {
      const intent = db.intents.get(m[1]);
      return intent && intent.userId === user.id ? json(res, 200, intent) : json(res, 404, { error: 'not_found' });
    }
    return json(res, 404, { error: 'not_found' });
  });

  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
  const site = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const origin = `http://${req.headers.host}`;
    if (url.pathname === '/api/gami/complete' && req.method === 'POST') {
      // The partner's own backend decides the action happened, then signs it.
      const body = await readBody(req);
      if (typeof body.questId !== 'string' || typeof body.nonce !== 'string') { res.writeHead(400); return res.end(); }
      const eventId = `evt_${randomUUID()}`;
      const timestamp = new Date().toISOString();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ eventId, timestamp, signature: sign(body.questId, origin, eventId, body.nonce, timestamp) }));
    }
    const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
    if (rel.includes('..')) { res.writeHead(400); return res.end(); }
    try {
      let data = await readFile(join(SITE_DIR, rel), 'utf8');
      if (rel.endsWith('gami.json')) data = data.replaceAll('http://localhost:8788', origin);
      const ext = rel.slice(rel.lastIndexOf('.'));
      res.writeHead(200, { 'Content-Type': TYPES[ext] ?? 'text/plain', 'Content-Security-Policy': "default-src 'self'" });
      res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });

  await Promise.all([new Promise((r) => api.listen(apiPort, '127.0.0.1', r)), new Promise((r) => site.listen(sitePort, '127.0.0.1', r))]);
  return {
    db, apiUrl: `http://127.0.0.1:${api.address().port}`, siteUrl: `http://127.0.0.1:${site.address().port}`,
    close: () => Promise.all([new Promise((r) => api.close(r)), new Promise((r) => site.close(r))]),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await startMock();
  console.log(`[gami mock] API  http://localhost:${new URL(s.apiUrl).port}  (dev sign-in code: ${DEV_CODE})`);
  console.log(`[gami mock] Site http://localhost:${new URL(s.siteUrl).port}`);
}

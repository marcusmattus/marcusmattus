import { useEffect, useState, type FormEvent } from 'react';
import { GAMI_MCP_TOOLS } from '../permissions/scopes';
import { SAFE_AGENT_SCOPES } from '../shared/constants';
import { userMessage } from '../shared/errors';
import { Banner, ConnectPrompt, ErrorNote, Header, Offline, QuestList, SignIn, SiteLine, SiteStatus, Stats, fmt, host, rewardText } from '../ui/components';
import { activeTabId, scanActiveTab, send, useStore } from '../ui/store';
import { useAuth } from '../ui/useAuth';

const TABS = ['NOVA', 'QUESTS', 'SITE', 'REWARDS', 'ACTIVITY', 'SETTINGS'] as const;
type Tab = (typeof TABS)[number];

function Nova() {
  const app = useStore((s) => s.app);
  const [text, setText] = useState('');
  const { nova } = app;
  const ask = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || nova.load === 'loading') return;
    setText('');
    void send({ type: 'NOVA_REQUEST', text: t });
  };
  const answer = (approve: boolean) => { if (nova.confirm) void send({ type: 'NOVA_RESPONSE', confirmId: nova.confirm.confirmId, approve }); };
  return (
    <>
      <div className="panelhead"><div className="eyebrow">NOVA / QUEST ASSISTANT</div>
        <div className="mono dim">SEES: SITE NAME, QUESTS, XP, LEVEL, REWARD STATUS. NOT THE PAGE.</div></div>
      <div className="chat" aria-live="polite">
        {nova.messages.length === 0 && <p className="muted">Ask what quests are here, what you can earn, or how close you are to the next level.</p>}
        {nova.messages.map((m) => <div key={m.id} className={`bubble ${m.role}`}>{m.text}</div>)}
        {nova.load === 'loading' && <div className="bubble nova" aria-busy="true">…</div>}
        {nova.load === 'error' && <Banner tone="bad">NOVA is unavailable. {nova.error ? userMessage(nova.error) : ''}</Banner>}
        {nova.confirm && (
          <div className="card prompt" role="dialog" aria-label="NOVA request">
            <div className="mono warnc">NOVA REQUESTS / {GAMI_MCP_TOOLS[nova.confirm.tool]?.scope.toUpperCase()}</div>
            <h3>Start {nova.confirm.title}?</h3>
            <p className="muted">NOVA cannot sign, transfer or export. It can only start quests you approve.</p>
            <div className="row"><button className="btn primary grow" onClick={() => answer(true)}>CONFIRM</button><button className="btn ghost grow" onClick={() => answer(false)}>CANCEL</button></div>
          </div>
        )}
      </div>
      <form className="ask" onSubmit={ask}>
        <label htmlFor="nova" className="sr">Ask NOVA about quests</label>
        <input id="nova" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Ask about quests on this site" />
        <button className="btn light" disabled={nova.load === 'loading'}>SEND</button>
      </form>
    </>
  );
}

function Site() {
  const app = useStore((s) => s.app);
  const { site } = app;
  return (
    <>
      <SiteLine app={app} />
      <SiteStatus app={app} />
      {site.status === 'supported' && (
        <>
          <dl className="table">
            <div><dt className="mono dim">SITE</dt><dd>{site.siteName}</dd></div>
            <div><dt className="mono dim">PARTNER</dt><dd className="mono">{site.partnerId}</dd></div>
            <div><dt className="mono dim">CAPABILITIES</dt><dd className="mono">{site.capabilities?.join(', ') || '—'}</dd></div>
          </dl>
          <div className="eyebrow">/ WEBMCP TOOLS DECLARED BY THIS SITE</div>
          {site.tools?.length ? (
            <ul className="list">{site.tools.map((t) => (
              <li key={t.name}><div><div className="mono">{t.name}</div><div className="muted small">{t.description}</div></div>
                <span className={`tag ${t.allowed ? 'goodb' : 'badb'}`}>{t.allowed ? t.riskLevel.toUpperCase() : 'BLOCKED'}</span></li>
            ))}</ul>
          ) : <p className="muted">None declared.</p>}
          <p className="muted small">Discovery only. Gami does not run site tools in this version. Transaction and sensitive tools are always blocked.</p>
          <button className="btn ghost" onClick={() => void scanActiveTab()}>SCAN AGAIN</button>
        </>
      )}
    </>
  );
}

function Rewards() {
  const app = useStore((s) => s.app);
  const b = app.balances;
  const items = Object.values(app.active).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  const pct = b?.nextLevelXp ? Math.min(100, Math.round((b.xp / b.nextLevelXp) * 100)) : null;
  const tag = (s: string) => s === 'confirmed' ? ['CONFIRMED', 'goodb'] : s === 'rejected' || s === 'error' ? ['REJECTED', 'badb'] : s === 'started' ? ['IN PROGRESS', 'warnb'] : ['PENDING', 'warnb'];
  return (
    <>
      <div className="eyebrow">/ REWARDS</div>
      <Stats app={app} />
      {b && pct !== null && (
        <div><div className="row mono dim"><span>LEVEL {String(b.level).padStart(2, '0')}</span><span>{fmt(Math.max(0, b.nextLevelXp! - b.xp))} XP TO NEXT</span></div>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div></div>
      )}
      <div className="eyebrow">/ THIS SESSION</div>
      {items.length === 0 ? <p className="muted">No quest rewards yet this session.</p> : (
        <ul className="list">{items.map((a) => { const [t, c] = tag(a.status); return (
          <li key={a.questId}><div><div>{a.title}</div><div className="mono dim">{host(a.origin).toUpperCase()} · {rewardText(a.reward)}</div></div><span className={`tag ${c}`}>{t}</span></li>
        ); })}</ul>
      )}
      <p className="muted small">Pending rewards are not counted in your balance until the server confirms them.</p>
      <button className="btn ghost" onClick={() => void send({ type: 'REFRESH' })}>REFRESH</button>
    </>
  );
}

const KIND: Record<string, string> = {
  quest_started: 'QUEST STARTED', quest_submitted: 'EVIDENCE SUBMITTED', reward_confirmed: 'REWARD CONFIRMED',
  quest_rejected: 'REJECTED', site_connected: 'SITE CONNECTED', site_disconnected: 'SITE DISCONNECTED',
};
function Activity() {
  const activity = useStore((s) => s.activity);
  return (
    <>
      <div className="eyebrow">/ ACTIVITY</div>
      {activity.length === 0 ? <p className="muted">Nothing yet. Start a quest on a Gami-enabled site.</p> : (
        <ul className="list">{activity.map((a) => (
          <li key={a.id}><div><div>{a.title}</div><div className="mono dim">{KIND[a.kind]}{a.reward ? ` · ${rewardText(a.reward)}` : ''} · {new Date(a.at).toLocaleString()}</div></div></li>
        ))}</ul>
      )}
      <p className="muted small">Kept on this device only. Cleared when you sign out.</p>
    </>
  );
}

function Settings({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const app = useStore((s) => s.app);
  const connections = useStore((s) => s.connections);
  const w = app.identity?.walletAddress;
  return (
    <>
      <div className="eyebrow">/ SETTINGS / CONNECTED SITES</div>
      {connections.length === 0 ? <p className="muted">No connected sites. You connect a site the first time you start one of its quests.</p> : connections.map((c) => (
        <div className="card" key={c.origin}>
          <div className="row"><span className="mono">{host(c.origin)}</span><span className="mono dim">CONNECTED {new Date(c.createdAt).toLocaleDateString()}</span></div>
          <div className="chips">{c.permissions.map((p) => <span className="tag" key={p}>{p}</span>)}</div>
          <button className="btn danger sm" onClick={() => void send({ type: 'CONNECTION_UPDATED', origin: c.origin, action: 'disconnect' })}>DISCONNECT</button>
        </div>
      ))}
      <div className="eyebrow">/ ACCOUNT</div>
      <dl className="table">
        <div><dt className="mono dim">WALLET</dt><dd className="mono" title={w}>{w ? `${w.slice(0, 6)}…${w.slice(-4)}` : '—'}</dd></div>
        <div><dt className="mono dim">NETWORK</dt><dd className="mono">{app.identity?.network ?? '—'}</dd></div>
        <div><dt className="mono dim">SIGN-IN</dt><dd className="mono">Privy</dd></div>
      </dl>
      <div className="eyebrow">/ NOVA SCOPES</div>
      <div className="chips">{SAFE_AGENT_SCOPES.map((s) => <span className="tag" key={s}>{s}</span>)}</div>
      <div className="eyebrow">/ PRIVACY</div>
      <p className="muted small">Gami reads a page only when you open it there. It keeps no browsing history, keystrokes or page content.</p>
      <a href="https://gamiprotocol.io/legal/chrome-extension-privacy" target="_blank" rel="noreferrer">Read the privacy policy</a>
      {auth.error && <Banner tone="bad">{auth.error}</Banner>}
      <button className="btn ghost" disabled={auth.busy} onClick={() => void auth.signOut()}>SIGN OUT</button>
    </>
  );
}

export function App() {
  const app = useStore((s) => s.app);
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('QUESTS');
  const [stale, setStale] = useState(false);

  useEffect(() => {
    void scanActiveTab();
    // Tab switches and navigations only mark the result stale. No URL is read
    // and nothing is scanned until the user asks.
    const onActivated = () => setStale(true);
    const onUpdated = (tabId: number, info: { status?: string }) => {
      if (info.status === 'loading') void activeTabId().then((id) => { if (id === tabId) setStale(true); });
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => { chrome.tabs.onActivated.removeListener(onActivated); chrome.tabs.onUpdated.removeListener(onUpdated); };
  }, []);
  useEffect(() => { if (app.site.status === 'scanning') setStale(false); }, [app.site.status]);

  const signedIn = app.auth.status === 'signed_in';
  return (
    <div className="shell panel">
      <Header app={app} />
      <Offline />
      {app.auth.status === 'loading' ? (
        <main className="body"><div className="empty" aria-busy="true"><h2>Loading your Gami identity…</h2></div></main>
      ) : app.auth.status === 'error' ? (
        <main className="body"><ErrorNote error={app.auth.error} onRetry={() => window.location.reload()} />
          <button className="btn ghost sm" onClick={() => void auth.signOut()}>SIGN OUT</button></main>
      ) : !signedIn ? (
        <main className="body"><SignIn auth={auth} expired={app.auth.status === 'expired'} /></main>
      ) : (
        <>
          <main className="body" role="tabpanel">
            {tab === 'NOVA' && <Nova />}
            {tab === 'QUESTS' && <><SiteLine app={app} /><ConnectPrompt app={app} /><SiteStatus app={app} stale={stale} />{!stale && <QuestList app={app} />}</>}
            {tab === 'SITE' && <Site />}
            {tab === 'REWARDS' && <Rewards />}
            {tab === 'ACTIVITY' && <Activity />}
            {tab === 'SETTINGS' && <Settings auth={auth} />}
          </main>
          <nav className="tabs" role="tablist">
            {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
          </nav>
        </>
      )}
    </div>
  );
}

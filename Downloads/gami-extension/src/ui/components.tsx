import { useState, type FormEvent, type ReactNode } from 'react';
import type { Quest, QuestReward } from '../schemas/quest';
import { userMessage, type ErrorInfo } from '../shared/errors';
import type { ActiveQuest, AppState } from '../shared/types';
import { scanActiveTab, send, useStore } from './store';
import type { useAuth } from './useAuth';
import logo from '../../public/icons/icon-128.png';

export const fmt = (n: number): string => n.toLocaleString('en-US');
export const rewardText = (r: QuestReward): string => `+${r.amount ? fmt(Number(r.amount)) : ''} ${r.type === 'TOKEN' && r.asset ? r.asset : r.type}`.replace('+ ', '+');
export const host = (origin?: string): string => { try { return origin ? new URL(origin).host : ''; } catch { return ''; } };

export function Header({ app }: { app: AppState }) {
  return (
    <header className="hdr">
      <img src={logo} alt="" width={28} height={28} />
      <span className="wordmark">GAMI</span>
      {app.auth.status === 'signed_in' && app.balances
        ? <><span className="mono dim">LVL</span><span className="lvl">{String(app.balances.level).padStart(2, '0')}</span></>
        : <span className="mono dim">{app.auth.status === 'signed_in' ? '' : 'SIGNED OUT'}</span>}
    </header>
  );
}

export function Banner({ tone, children, action }: { tone: 'warn' | 'bad' | 'info'; children: ReactNode; action?: ReactNode }) {
  return <div className={`banner ${tone}`} role={tone === 'bad' ? 'alert' : 'status'}><div>{children}</div>{action}</div>;
}

export function ErrorNote({ error, onRetry }: { error?: ErrorInfo; onRetry?: () => void }) {
  if (!error) return null;
  return <Banner tone="bad" action={onRetry && <button className="btn sm ghost" onClick={onRetry}>RETRY</button>}>{userMessage(error)}</Banner>;
}

export function Offline() {
  const online = useStore((s) => s.online);
  return online ? null : <Banner tone="warn">You are offline. Gami will retry when you reconnect.</Banner>;
}

export function SignIn({ auth, expired }: { auth: ReturnType<typeof useAuth>; expired: boolean }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const { step } = auth;
  const submitEmail = (e: FormEvent) => { e.preventDefault(); void auth.sendCode(email.trim()); };
  const submitCode = (e: FormEvent) => { e.preventDefault(); if (step.step === 'code') void auth.verify(step.email, code.trim()); };
  return (
    <section className="signin">
      <img className="biglogo" src={logo} alt="" width={88} height={88} />
      <div className="eyebrow">GAMI EXTENSION</div>
      <h1>Quest the web</h1>
      <p className="muted">Discover quests and earn rewards on Gami-enabled websites.</p>
      {expired && <Banner tone="warn">Your session expired. Sign in again.</Banner>}
      {auth.error && <Banner tone="bad">{auth.error}</Banner>}
      {step.step === 'email' ? (
        <form onSubmit={submitEmail} className="stack">
          <label htmlFor="email" className="mono dim">EMAIL</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button className="btn primary shadow" disabled={auth.busy}>{auth.busy ? 'SENDING CODE…' : 'SIGN UP WITH EMAIL'}</button>
          <p className="mono dim">ALREADY HAVE AN ACCOUNT? THE SAME BUTTON SIGNS YOU IN.</p>
        </form>
      ) : (
        <form onSubmit={submitCode} className="stack">
          <label htmlFor="code" className="mono dim">CODE SENT TO {step.email.toUpperCase()}</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{4,8}" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" />
          <button className="btn primary shadow" disabled={auth.busy}>{auth.busy ? 'CHECKING…' : 'CONFIRM CODE'}</button>
          <button type="button" className="btn ghost sm" onClick={auth.reset}>USE A DIFFERENT EMAIL</button>
        </form>
      )}
      <p className="mono dim foot">SIGN-UP BY PRIVY. NO SEED PHRASE. KEYS ARE NEVER STORED IN THE EXTENSION.</p>
    </section>
  );
}

export function Stats({ app }: { app: AppState }) {
  if (app.balancesLoad === 'error' && !app.balances) return <ErrorNote error={app.balancesError} onRetry={() => void send({ type: 'REFRESH' })} />;
  const b = app.balances;
  return (
    <div className="stats" aria-busy={app.balancesLoad === 'loading'}>
      <div className="stat"><b>{b ? fmt(b.xp) : '—'}</b><span className="mono dim">XP</span></div>
      <div className="stat"><b>{b ? fmt(b.points) : '—'}</b><span className="mono dim">UNIVERSAL POINTS</span></div>
    </div>
  );
}

const SITE_COPY: Record<string, { title: string; body: string }> = {
  idle: { title: 'Not checked yet', body: 'Scan to check this site for Gami quests.' },
  unsupported: { title: 'No Gami quests found', body: 'This site has no Gami integration. Gami only checks a page when you open it or scan.' },
  restricted: { title: 'Gami needs your click', body: 'Click the Gami toolbar button on this tab so Gami can check it.' },
  invalid_manifest: { title: 'Invalid Gami manifest', body: 'This site declares Gami support, but its manifest failed validation.' },
  not_registered: { title: 'Site not registered', body: 'This site is not a registered Gami partner for this domain.' },
  error: { title: 'Could not check this site', body: 'Something went wrong while checking the page.' },
};

export function SiteStatus({ app, stale }: { app: AppState; stale?: boolean }) {
  const { site } = app;
  const [busy, setBusy] = useState(false);
  const scan = () => { setBusy(true); void scanActiveTab().finally(() => setBusy(false)); };
  if (site.status === 'scanning' || busy) return <div className="empty" aria-busy="true"><h2>Checking this site…</h2></div>;
  if (stale) return <div className="empty"><h2>Page changed</h2><p className="muted">Scan to check the page you are on now.</p><button className="btn ghost shadow" onClick={scan}>SCAN CURRENT SITE</button></div>;
  if (site.status === 'supported') return null;
  const copy = SITE_COPY[site.status] ?? SITE_COPY.error!;
  return (
    <div className="empty">
      <h2>{copy.title}</h2>
      <p className="muted">{site.detail ?? copy.body}</p>
      <button className="btn ghost shadow" onClick={scan}>SCAN CURRENT SITE</button>
    </div>
  );
}

export function SiteLine({ app }: { app: AppState }) {
  const n = app.quests.filter((q) => q.status === 'active').length;
  return (
    <div className="siteline">
      <div><div className="eyebrow">CURRENT SITE</div><div className="mono site">{host(app.site.origin) || '—'}</div></div>
      {app.site.status === 'supported' && app.questsLoad === 'ready' && (
        <div className={`mono ${n ? 'good' : 'dim'}`}>{n ? `● ${n} QUEST${n === 1 ? '' : 'S'} AVAILABLE` : 'NO ACTIVE QUESTS'}</div>
      )}
    </div>
  );
}

const ACTIVE_LABEL: Record<ActiveQuest['status'], { text: string; tone: string }> = {
  started: { text: 'IN PROGRESS · COMPLETE THE ACTION ON THE PAGE', tone: 'warnc' },
  submitting: { text: 'SUBMITTING EVIDENCE', tone: 'warnc' },
  pending: { text: 'VERIFICATION PENDING', tone: 'warnc' },
  reward_pending: { text: 'VERIFIED · REWARD PENDING', tone: 'warnc' },
  confirmed: { text: 'REWARD CONFIRMED', tone: 'good' },
  rejected: { text: 'VERIFICATION REJECTED', tone: 'badc' },
  error: { text: 'ERROR', tone: 'badc' },
};

export function QuestCard({ quest, active, compact }: { quest: Quest; active?: ActiveQuest; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expired = quest.status === 'expired' || (quest.endAt !== undefined && Date.parse(quest.endAt) <= Date.now());
  const unavailable = quest.status !== 'active' && !expired;
  const start = () => {
    setBusy(true); setError(null);
    void send({ type: 'QUEST_STARTED', questId: quest.id }).then((r) => {
      if (!r.ok && r.error.code !== 'permission_denied') setError(userMessage(r.error as ErrorInfo));
    }).finally(() => setBusy(false));
  };
  if (active?.status === 'confirmed') {
    return (
      <article className="card done">
        <div className="mono">● QUEST COMPLETE</div>
        <div className="bigreward">{rewardText(active.reward)}</div>
        <div>{quest.title} · Reward confirmed.</div>
      </article>
    );
  }
  const label = active ? ACTIVE_LABEL[active.status] : null;
  const canStart = !active || active.status === 'rejected' || active.status === 'error';
  return (
    <article className={`card ${expired || unavailable ? 'off' : ''}`}>
      {!compact && <div className="mono dim">{quest.category.toUpperCase()}</div>}
      <div className="row"><h3>{quest.title}</h3><span className="mono reward">{rewardText(quest.reward)}</span></div>
      <p className="muted">{quest.description}</p>
      {!compact && (
        <dl className="meta">
          <div><dt className="mono dim">REQUIRES</dt><dd>{quest.requirements.map((r) => r.description).join(' · ') || '—'}</dd></div>
          <div><dt className="mono dim">VERIFICATION</dt><dd>{quest.verification.label}</dd></div>
          {quest.endAt && <div><dt className="mono dim">EXPIRES</dt><dd>{new Date(quest.endAt).toLocaleDateString()}</dd></div>}
        </dl>
      )}
      {label && <div className={`mono ${label.tone}`} role="status">{label.text}</div>}
      {active?.detail && <p className="muted small">{active.detail}</p>}
      {error && <p className="badc small" role="alert">{error}</p>}
      <div className="row">
        <span className="mono dim">{expired ? 'EXPIRED' : unavailable ? quest.status.toUpperCase() : compact ? quest.verification.label.toUpperCase() : ''}</span>
        {expired || unavailable ? null : canStart
          ? <button className="btn primary" disabled={busy} onClick={start}>{busy ? 'STARTING…' : active ? 'TRY AGAIN' : 'START QUEST'}</button>
          : active && active.detail && active.status !== 'started'
            ? <button className="btn ghost sm" onClick={() => void send({ type: 'REFRESH' })}>CHECK AGAIN</button>
            : null}
      </div>
    </article>
  );
}

export function ConnectPrompt({ app }: { app: AppState }) {
  const p = app.pendingConnection;
  if (!p) return null;
  const answer = (approve: boolean) => void send({ type: 'CONNECTION_REQUEST', origin: p.origin, approve });
  return (
    <div className="card prompt" role="dialog" aria-label="Connect site">
      <div className="mono warnc">CONNECT SITE</div>
      <h3>Connect {host(p.origin)}?</h3>
      <p className="muted">Gami will be able to read, start and submit quests for this site. Nothing else. You can disconnect in Settings.</p>
      <div className="row"><button className="btn primary grow" onClick={() => answer(true)}>CONNECT</button><button className="btn ghost grow" onClick={() => answer(false)}>CANCEL</button></div>
    </div>
  );
}

export function QuestList({ app, compact }: { app: AppState; compact?: boolean }) {
  if (app.site.status !== 'supported') return null;
  if (app.questsLoad === 'loading') return <div className="empty" aria-busy="true"><h2>Loading quests…</h2></div>;
  if (app.questsLoad === 'error') return <ErrorNote error={app.questsError} onRetry={() => void send({ type: 'REFRESH' })} />;
  if (app.quests.length === 0) return <div className="empty"><h2>No quests right now</h2><p className="muted">This site is Gami-enabled but has no quests available.</p></div>;
  const list = compact ? app.quests.slice(0, 2) : app.quests;
  return <>{list.map((q) => <QuestCard key={q.id} quest={q} active={app.active[q.id]} compact={compact} />)}</>;
}

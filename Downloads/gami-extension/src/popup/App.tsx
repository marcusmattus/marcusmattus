import { useEffect, useRef } from 'react';
import { ConnectPrompt, Header, Offline, QuestList, SignIn, SiteLine, SiteStatus, Stats } from '../ui/components';
import { scanActiveTab, send, useStore } from '../ui/store';
import { useAuth } from '../ui/useAuth';

export function App() {
  const app = useStore((s) => s.app);
  const ready = useStore((s) => s.ready);
  const auth = useAuth();
  const windowId = useRef<number | null>(null);

  useEffect(() => {
    // Opening the popup is the user's invocation: check the active tab once.
    void scanActiveTab();
    void chrome.windows.getCurrent().then((w) => { windowId.current = w.id ?? null; });
  }, []);

  const openPanel = () => {
    if (windowId.current !== null) void chrome.sidePanel.open({ windowId: windowId.current }).then(() => window.close());
  };

  if (!ready) return <div className="shell" aria-busy="true" />;
  const signedIn = app.auth.status === 'signed_in';
  return (
    <div className="shell">
      <Header app={app} />
      <Offline />
      {app.auth.status === 'loading' ? (
        <main className="body"><div className="empty" aria-busy="true"><h2>Loading your Gami identity…</h2></div></main>
      ) : app.auth.status === 'error' ? (
        <main className="body"><div className="empty"><h2>Could not load your identity</h2><p className="muted">{app.auth.error?.message}</p>
          <button className="btn ghost shadow" onClick={() => void send({ type: 'REFRESH' }).then(() => window.location.reload())}>RETRY</button>
          <button className="btn ghost sm" onClick={() => void auth.signOut()}>SIGN OUT</button></div></main>
      ) : !signedIn ? (
        <main className="body"><SignIn auth={auth} expired={app.auth.status === 'expired'} /></main>
      ) : (
        <>
          <main className="body">
            <Stats app={app} />
            <SiteLine app={app} />
            <ConnectPrompt app={app} />
            <SiteStatus app={app} />
            <QuestList app={app} compact />
          </main>
          <footer className="foot-actions">
            <button className="btn light grow" onClick={openPanel}>OPEN SIDE PANEL</button>
          </footer>
        </>
      )}
    </div>
  );
}

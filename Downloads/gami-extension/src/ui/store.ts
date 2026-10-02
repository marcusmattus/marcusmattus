import { create } from 'zustand';
import { newRequestId, type Reply, type UiMessage } from '../schemas/messages';
import { ACTIVITY_KEY, CONNECTIONS_KEY, STATE_KEY } from '../shared/constants';
import { initialState, type ActivityEntry, type AppState } from '../shared/types';
import type { SiteConnection } from '../permissions/sitePermissions';

type Store = {
  app: AppState;
  connections: SiteConnection[];
  activity: ActivityEntry[];
  online: boolean;
  ready: boolean;
};

export const useStore = create<Store>(() => ({
  app: initialState(), connections: [], activity: [], online: navigator.onLine, ready: false,
}));

/** Mirror extension storage into the UI. The background worker is the only writer of app state. */
export async function initStore(): Promise<void> {
  const [session, local] = await Promise.all([
    chrome.storage.session.get(STATE_KEY),
    chrome.storage.local.get([CONNECTIONS_KEY, ACTIVITY_KEY]),
  ]);
  useStore.setState({
    app: (session[STATE_KEY] as AppState | undefined) ?? initialState(),
    connections: (local[CONNECTIONS_KEY] as SiteConnection[] | undefined) ?? [],
    activity: (local[ACTIVITY_KEY] as ActivityEntry[] | undefined) ?? [],
    ready: true,
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes[STATE_KEY]) {
      useStore.setState({ app: (changes[STATE_KEY].newValue as AppState | undefined) ?? initialState() });
    }
    if (area === 'local') {
      if (changes[CONNECTIONS_KEY]) useStore.setState({ connections: (changes[CONNECTIONS_KEY].newValue as SiteConnection[] | undefined) ?? [] });
      if (changes[ACTIVITY_KEY]) useStore.setState({ activity: (changes[ACTIVITY_KEY].newValue as ActivityEntry[] | undefined) ?? [] });
    }
  });
  window.addEventListener('online', () => useStore.setState({ online: true }));
  window.addEventListener('offline', () => useStore.setState({ online: false }));
}

type Command = UiMessage extends infer M ? (M extends { requestId: string } ? Omit<M, 'requestId'> : never) : never;

export async function send(command: Command): Promise<Reply> {
  try {
    const reply = (await chrome.runtime.sendMessage({ ...command, requestId: newRequestId() })) as Reply | undefined;
    return reply ?? { ok: false, error: { code: 'unknown', message: 'No response from Gami.' } };
  } catch {
    return { ok: false, error: { code: 'unknown', message: 'Gami is restarting. Try again.' } };
  }
}

export async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

export async function scanActiveTab(): Promise<void> {
  const tabId = await activeTabId();
  if (tabId !== null) await send({ type: 'SCAN_SITE', tabId });
}

import { ACTIVITY_KEY, CONNECTIONS_KEY, MAX_ACTIVITY, SESSION_KEY, STATE_KEY } from '../shared/constants';
import { initialState, type ActivityEntry, type AppState, type SessionRecord } from '../shared/types';
import type { SiteConnection } from '../permissions/sitePermissions';

/**
 * chrome.storage.session: in-memory, cleared when the browser closes. Holds
 * the UI state and the short-lived access token.
 * chrome.storage.local: connected sites and the activity log. Never keys.
 */
export async function getState(): Promise<AppState> {
  const got = await chrome.storage.session.get(STATE_KEY);
  return (got[STATE_KEY] as AppState | undefined) ?? initialState();
}

let queue: Promise<unknown> = Promise.resolve();

/** Serialised read-modify-write so concurrent handlers cannot clobber each other. */
export function updateState(fn: (s: AppState) => AppState | void): Promise<AppState> {
  const run = queue.then(async () => {
    const current = await getState();
    const next = fn(current) ?? current;
    await chrome.storage.session.set({ [STATE_KEY]: next });
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function getSession(): Promise<SessionRecord | null> {
  const got = await chrome.storage.session.get(SESSION_KEY);
  return (got[SESSION_KEY] as SessionRecord | undefined) ?? null;
}
export async function setSession(session: SessionRecord | null): Promise<void> {
  if (session) await chrome.storage.session.set({ [SESSION_KEY]: session });
  else await chrome.storage.session.remove(SESSION_KEY);
}

export async function getConnections(): Promise<SiteConnection[]> {
  const got = await chrome.storage.local.get(CONNECTIONS_KEY);
  return (got[CONNECTIONS_KEY] as SiteConnection[] | undefined) ?? [];
}
export async function setConnections(list: SiteConnection[]): Promise<void> {
  await chrome.storage.local.set({ [CONNECTIONS_KEY]: list });
}

export async function getActivity(): Promise<ActivityEntry[]> {
  const got = await chrome.storage.local.get(ACTIVITY_KEY);
  return (got[ACTIVITY_KEY] as ActivityEntry[] | undefined) ?? [];
}
export async function addActivity(entry: Omit<ActivityEntry, 'id' | 'at'>): Promise<void> {
  const list = await getActivity();
  list.unshift({ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() });
  await chrome.storage.local.set({ [ACTIVITY_KEY]: list.slice(0, MAX_ACTIVITY) });
}

export async function clearUserData(): Promise<void> {
  await chrome.storage.session.remove([STATE_KEY, SESSION_KEY]);
  await chrome.storage.local.remove([ACTIVITY_KEY]);
}

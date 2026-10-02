import { fetchBalances, fetchIdentity } from '../api/identity';
import { GamiError, toErrorInfo } from '../shared/errors';
import { initialState, type SessionRecord } from '../shared/types';
import { clearUserData, getSession, setSession, updateState } from '../storage';

async function markExpired(): Promise<void> {
  await setSession(null);
  await updateState((s) => { s.auth = { status: 'expired' }; });
}

/** Runs `fn` with a live token. A missing, expired or rejected token moves the UI to the expired state. */
export async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const session = await getSession();
  if (!session || session.expiresAt <= Date.now()) {
    if (session) await markExpired();
    throw new GamiError('unauthorized', 'Session expired.');
  }
  try {
    return await fn(session.token);
  } catch (e) {
    if (e instanceof GamiError && e.code === 'unauthorized') await markExpired();
    throw e;
  }
}

export async function loadBalances(): Promise<void> {
  await updateState((s) => { s.balancesLoad = 'loading'; delete s.balancesError; });
  try {
    const balances = await withToken(fetchBalances);
    await updateState((s) => { s.balances = balances; s.balancesLoad = 'ready'; });
  } catch (e) {
    await updateState((s) => { s.balancesLoad = 'error'; s.balancesError = toErrorInfo(e); });
  }
}

export async function loadIdentity(): Promise<void> {
  try {
    const identity = await withToken(fetchIdentity);
    await updateState((s) => { s.identity = identity; s.auth = { status: 'signed_in' }; });
    await loadBalances();
  } catch (e) {
    if (e instanceof GamiError && e.code === 'unauthorized') return;
    await updateState((s) => { s.auth = { status: 'error', error: toErrorInfo(e) }; });
  }
}

/** The popup or side panel reports the auth provider's session (or null on sign-out). */
export async function applySession(session: SessionRecord | null): Promise<void> {
  if (!session) {
    await clearUserData();
    await updateState(() => initialState());
    return;
  }
  if (session.expiresAt <= Date.now()) { await markExpired(); return; }
  const previous = await getSession();
  await setSession(session);
  if (previous?.token === session.token) {
    const next = await updateState(() => undefined);
    if (next.auth.status === 'signed_in' && next.identity) return;
  }
  await updateState((s) => { s.auth = { status: 'loading' }; });
  await loadIdentity();
}

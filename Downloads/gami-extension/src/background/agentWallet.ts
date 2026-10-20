import { fetchAgentWallet } from '../api/agentWallet';
import { config } from '../shared/config';
import { toErrorInfo } from '../shared/errors';
import { getSession, updateState } from '../storage';

/**
 * Loads NOVA's wallet-access status for display. It is a separate service from the Gami
 * API, so a failure here (including a rejected token) only marks this status as
 * unavailable. It never ends the user's session.
 */
let latestLoad = 0;

export async function loadAgentWallet(): Promise<void> {
  if (!config.agentUrl) return;
  const session = await getSession();
  if (!session || session.expiresAt <= Date.now()) return;
  const load = ++latestLoad;
  // A load is stale once a newer one starts, or once the session it started with is gone
  // (sign-out) or replaced (another account). A stale result must not touch current state.
  const isStale = async () => load !== latestLoad || (await getSession())?.token !== session.token;
  await updateState((s) => { s.agentWalletLoad = 'loading'; delete s.agentWalletError; });
  try {
    const status = await fetchAgentWallet(session.token);
    if (await isStale()) return;
    await updateState((s) => { s.agentWallet = status; s.agentWalletLoad = 'ready'; });
  } catch (e) {
    if (await isStale()) return;
    await updateState((s) => { delete s.agentWallet; s.agentWalletLoad = 'error'; s.agentWalletError = toErrorInfo(e); });
  }
}

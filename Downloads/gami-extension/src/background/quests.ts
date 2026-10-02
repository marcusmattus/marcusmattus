import { startQuest, submitQuest } from '../api/quests';
import { fetchReward } from '../api/rewards';
import { hasPermission, touchConnection } from '../permissions/sitePermissions';
import type { QuestEvidence } from '../schemas/evidence';
import type { PageQuestEvent, ToContentMessage } from '../schemas/messages';
import { REWARD_POLL_INTERVAL_MS, REWARD_POLL_MAX_ATTEMPTS } from '../shared/constants';
import { GamiError, toErrorInfo, userMessage } from '../shared/errors';
import type { ActiveQuest } from '../shared/types';
import { addActivity, getState, updateState } from '../storage';
import { loadBalances, withToken } from './auth';

const now = (): string => new Date().toISOString();

async function patchActive(questId: string, patch: Partial<ActiveQuest>): Promise<void> {
  await updateState((s) => {
    const a = s.active[questId];
    if (a) s.active[questId] = { ...a, ...patch, updatedAt: now() };
  });
}

export async function startQuestFlow(questId: string): Promise<void> {
  const state = await getState();
  const { site } = state;
  if (state.auth.status !== 'signed_in' || !state.identity) throw new GamiError('unauthorized', 'Sign in to start quests.');
  if (site.status !== 'supported' || !site.origin || site.tabId === undefined) {
    throw new GamiError('quest_unavailable', 'Open Gami on a Gami-enabled site first.');
  }
  const quest = state.quests.find((q) => q.id === questId);
  if (!quest || quest.status !== 'active') throw new GamiError('quest_unavailable', 'This quest is not available.');
  if (quest.endAt && Date.parse(quest.endAt) <= Date.now()) throw new GamiError('quest_expired', 'This quest has expired.');
  const existing = state.active[questId];
  if (existing && existing.status !== 'rejected' && existing.status !== 'error') {
    if (existing.status === 'confirmed') throw new GamiError('already_completed', 'You already completed this quest.');
    return; // already in flight: starting twice is a no-op
  }
  if (!(await hasPermission(site.origin, 'quests:start'))) {
    await updateState((s) => {
      s.pendingConnection = { origin: site.origin!, siteName: site.siteName ?? site.origin!, partnerId: site.partnerId, questId };
    });
    throw new GamiError('permission_denied', 'Connect this site to start its quests.');
  }
  const origin = site.origin;
  const tabId = site.tabId;
  const started = await withToken((t) => startQuest(t, questId, origin));
  await updateState((s) => {
    s.active[questId] = {
      questId, title: quest.title, origin, tabId, startId: started.startId, nonce: started.nonce,
      status: 'started', reward: quest.reward, updatedAt: now(),
    };
  });
  await touchConnection(origin);
  await addActivity({ kind: 'quest_started', title: quest.title, origin });
  const msg: ToContentMessage = { type: 'QUEST_PROGRESS', questId, nonce: started.nonce };
  try { await chrome.tabs.sendMessage(tabId, msg); } catch { /* the page can still complete after a re-scan */ }
}

/**
 * A completion event relayed by the content script. The page is untrusted:
 * the event must come from the tab and origin the quest was started on, carry
 * the nonce issued at start, and the quest must still be waiting. The flip to
 * `submitting` is atomic, so replays and duplicates stop here.
 */
export async function handleQuestEvent(event: PageQuestEvent, sender: { tabId: number; origin: string }): Promise<void> {
  let claimed: ActiveQuest | null = null;
  let reject = '';
  await updateState((s) => {
    const a = s.active[event.questId];
    if (!a) { reject = 'quest was not started'; return; }
    if (a.status !== 'started') { reject = 'quest is not awaiting completion'; return; }
    if (a.tabId !== sender.tabId || a.origin !== sender.origin) { reject = 'event came from another page'; return; }
    if (a.nonce !== event.nonce) { reject = 'nonce does not match'; return; }
    const evidence: QuestEvidence = {
      kind: 'partner_signature', questId: event.questId, origin: sender.origin,
      eventId: event.eventId, nonce: event.nonce, timestamp: event.timestamp, signature: event.signature,
    };
    claimed = { ...a, status: 'submitting', evidence, updatedAt: now() };
    s.active[event.questId] = claimed;
  });
  if (!claimed) throw new GamiError('invalid_message', reject || 'event rejected');
  await submitActive(event.questId);
}

const inFlight = new Set<string>();

/** Submit stored evidence. Safe to repeat: the idempotency key is fixed per start. */
export async function submitActive(questId: string): Promise<void> {
  if (inFlight.has(questId)) return;
  inFlight.add(questId);
  try {
    const state = await getState();
    const a = state.active[questId];
    const userId = state.identity?.id;
    if (!a || !a.evidence || !userId) return;
    if (a.status === 'submitting') {
      try {
        const result = await withToken((t) => submitQuest(t, userId, questId, a.startId, [a.evidence!]));
        await addActivity({ kind: 'quest_submitted', title: a.title, origin: a.origin });
        if (result.status === 'rejected' || !result.rewardIntentId) {
          await patchActive(questId, { status: 'rejected', submissionId: result.submissionId, detail: result.reason ?? 'Evidence was not accepted.' });
          await addActivity({ kind: 'quest_rejected', title: a.title, origin: a.origin });
          return;
        }
        await patchActive(questId, {
          status: result.status === 'verified' ? 'reward_pending' : 'pending',
          submissionId: result.submissionId, intentId: result.rewardIntentId,
        });
      } catch (e) {
        // Stays `submitting` with its evidence so a refresh can retry with the same key.
        await patchActive(questId, { detail: userMessage(toErrorInfo(e)) });
        return;
      }
    }
    await pollReward(questId);
  } finally {
    inFlight.delete(questId);
  }
}

async function pollReward(questId: string): Promise<void> {
  for (let i = 0; i < REWARD_POLL_MAX_ATTEMPTS; i++) {
    const a = (await getState()).active[questId];
    if (!a || !a.intentId || (a.status !== 'pending' && a.status !== 'reward_pending')) return;
    try {
      const intent = await withToken((t) => fetchReward(t, a.intentId!));
      if (intent.status === 'confirmed') {
        await patchActive(questId, { status: 'confirmed', reward: intent.reward, detail: undefined });
        await addActivity({ kind: 'reward_confirmed', title: a.title, origin: a.origin, reward: intent.reward });
        await loadBalances();
        return;
      }
      if (intent.status === 'rejected') {
        await patchActive(questId, { status: 'rejected', detail: 'The reward was rejected.' });
        await addActivity({ kind: 'quest_rejected', title: a.title, origin: a.origin });
        return;
      }
      await patchActive(questId, { status: intent.status === 'pending' ? 'pending' : 'reward_pending', detail: undefined });
    } catch (e) {
      await patchActive(questId, { detail: userMessage(toErrorInfo(e)) });
      if (e instanceof GamiError && e.code === 'unauthorized') return;
    }
    await new Promise((r) => setTimeout(r, REWARD_POLL_INTERVAL_MS));
  }
  await patchActive(questId, { detail: 'Still waiting for confirmation. Retry to check again.' });
}

/** After a service-worker restart or on demand: pick unfinished quests back up. */
export async function resumePending(): Promise<void> {
  const state = await getState();
  await Promise.all(
    Object.values(state.active)
      .filter((a) => a.status === 'submitting' || a.status === 'pending' || a.status === 'reward_pending')
      .map((a) => submitActive(a.questId)),
  );
}

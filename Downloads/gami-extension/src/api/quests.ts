import { idempotencyKey, QuestSubmissionResultSchema, type QuestEvidence, type QuestSubmissionResult } from '../schemas/evidence';
import { QuestListSchema, QuestStartSchema, type Quest, type QuestStart } from '../schemas/quest';
import { request } from './client';

/** The Gami API is the source of truth for quests: it checks that the partner is registered for the origin. */
export async function fetchQuests(token: string | null, origin: string, partnerId: string): Promise<Quest[]> {
  const q = new URLSearchParams({ origin, partnerId });
  return (await request(`/quests?${q.toString()}`, QuestListSchema, { token })).quests;
}

export function startQuest(token: string, questId: string, origin: string): Promise<QuestStart> {
  return request(`/quests/${encodeURIComponent(questId)}/start`, QuestStartSchema, { method: 'POST', token, body: { origin } });
}

export function submitQuest(
  token: string, userId: string, questId: string, startId: string, evidence: QuestEvidence[],
): Promise<QuestSubmissionResult> {
  return request(`/quests/${encodeURIComponent(questId)}/submit`, QuestSubmissionResultSchema, {
    method: 'POST',
    token,
    body: { startId, evidence },
    headers: { 'Idempotency-Key': idempotencyKey(questId, userId, startId) },
  });
}

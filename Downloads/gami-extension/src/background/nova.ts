import { askNova, requestAgentCredential, type NovaContext } from '../api/nova';
import { authorizeAgentTool } from '../permissions/scopes';
import type { GamiAgentCredential } from '../schemas/agent';
import { toErrorInfo } from '../shared/errors';
import type { AppState, NovaMessage } from '../shared/types';
import { getState, updateState } from '../storage';
import { withToken } from './auth';
import { startQuestFlow } from './quests';

let credential: GamiAgentCredential | null = null;

function msg(role: NovaMessage['role'], text: string): NovaMessage {
  return { id: crypto.randomUUID(), role, text };
}

async function push(...messages: NovaMessage[]): Promise<void> {
  await updateState((s) => { s.nova.messages = [...s.nova.messages, ...messages].slice(-40); });
}

/** Structured Gami state only. Page content is never included. */
export function buildNovaContext(s: AppState): NovaContext {
  return {
    origin: s.site.status === 'supported' ? s.site.origin ?? null : null,
    siteName: s.site.status === 'supported' ? s.site.siteName ?? null : null,
    quests: s.quests.map((q) => ({
      id: q.id, title: q.title, description: q.description,
      reward: `${q.reward.amount ?? ''} ${q.reward.type}`.trim(), status: q.status, verification: q.verification.label,
    })),
    activeQuests: Object.values(s.active).map((a) => ({ questId: a.questId, status: a.status })),
    capabilities: s.site.capabilities ?? [],
    xp: s.balances?.xp ?? null,
    level: s.balances?.level ?? null,
    nextLevelXp: s.balances?.nextLevelXp ?? null,
    points: s.balances?.points ?? null,
  };
}

async function getCredential(state: AppState): Promise<GamiAgentCredential> {
  const userId = state.identity?.id;
  if (credential && credential.userId === userId && Date.parse(credential.expiresAt) > Date.now() + 5_000) return credential;
  credential = await withToken((t) => requestAgentCredential(t, state.site.origin ?? null));
  return credential;
}

export function clearAgentCredential(): void { credential = null; }

export async function novaAsk(text: string, requestId: string): Promise<void> {
  await updateState((s) => { s.nova.load = 'loading'; delete s.nova.error; delete s.nova.confirm; });
  await push(msg('user', text));
  try {
    const state = await getState();
    const cred = await getCredential(state);
    const reply = await askNova(cred, text, buildNovaContext(state), requestId);
    await push(msg('nova', reply.reply));
    if (reply.toolRequest) await handleToolRequest(reply.toolRequest.tool, reply.toolRequest.args, cred, state);
    await updateState((s) => { s.nova.load = 'ready'; });
  } catch (e) {
    await updateState((s) => { s.nova.load = 'error'; s.nova.error = toErrorInfo(e); });
  }
}

async function handleToolRequest(tool: string, args: Record<string, unknown>, cred: GamiAgentCredential, state: AppState): Promise<void> {
  const questId = typeof args.questId === 'string' ? args.questId : undefined;
  const decision = authorizeAgentTool(cred, tool, { now: Date.now(), userId: state.identity?.id ?? '', questId });
  if (!decision.ok) {
    await push(msg('system', `NOVA asked to use ${tool.slice(0, 64)}. Blocked: ${decision.reason}.`));
    return;
  }
  if (!decision.requiresConfirmation) return; // read tools: the data is already in NOVA's context
  if (tool !== 'gami.quests.start') {
    await push(msg('system', `NOVA cannot run ${tool} in this version.`));
    return;
  }
  const quest = state.quests.find((q) => q.id === questId);
  if (!quest) {
    await push(msg('system', 'NOVA asked to start a quest that is not on this site. Blocked.'));
    return;
  }
  await updateState((s) => { s.nova.confirm = { confirmId: crypto.randomUUID(), tool, questId: quest.id, title: quest.title }; });
}

/** Nothing NOVA requests runs until the user presses Confirm. */
export async function novaConfirm(confirmId: string, approve: boolean): Promise<void> {
  const state = await getState();
  const confirm = state.nova.confirm;
  if (!confirm || confirm.confirmId !== confirmId) return;
  await updateState((s) => { delete s.nova.confirm; });
  if (!approve) { await push(msg('system', 'Cancelled.')); return; }
  const decision = authorizeAgentTool(credential, confirm.tool, { now: Date.now(), userId: state.identity?.id ?? '', questId: confirm.questId });
  if (!decision.ok) { await push(msg('system', `Blocked: ${decision.reason}.`)); return; }
  try {
    await startQuestFlow(confirm.questId);
    await push(msg('system', `Started: ${confirm.title}.`));
  } catch (e) {
    await push(msg('system', `Could not start: ${toErrorInfo(e).message}`));
  }
}

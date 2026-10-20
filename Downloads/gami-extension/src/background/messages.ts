import { connectSite, disconnectSite } from '../permissions/sitePermissions';
import { classifySender, ContentMessageSchema, UiMessageSchema, type Reply } from '../schemas/messages';
import { GamiError, toErrorInfo } from '../shared/errors';
import { addActivity, getState, updateState } from '../storage';
import { loadAgentWallet } from './agentWallet';
import { applySession, loadBalances } from './auth';
import { clearAgentCredential, novaAsk, novaConfirm } from './nova';
import { handleQuestEvent, resumePending, startQuestFlow } from './quests';
import { loadQuests, scanSite } from './site';

const seenRequests = new Set<string>();
function firstTime(requestId: string): boolean {
  if (seenRequests.has(requestId)) return false;
  seenRequests.add(requestId);
  if (seenRequests.size > 500) seenRequests.delete(seenRequests.values().next().value as string);
  return true;
}

async function handleUi(raw: unknown): Promise<void> {
  const parsed = UiMessageSchema.safeParse(raw);
  if (!parsed.success) throw new GamiError('invalid_message', 'Unrecognised message.');
  const m = parsed.data;
  if (!firstTime(m.requestId)) return;
  switch (m.type) {
    case 'AUTH_STATUS':
      if (!m.session) clearAgentCredential();
      await applySession(m.session);
      if (m.session) { await loadQuests(); await resumePending(); await loadAgentWallet(); }
      return;
    case 'REFRESH':
      await Promise.all([loadBalances(), loadQuests(), loadAgentWallet()]);
      await resumePending();
      return;
    case 'SCAN_SITE':
      return scanSite(m.tabId);
    case 'QUEST_STARTED':
      return startQuestFlow(m.questId);
    case 'CONNECTION_REQUEST': {
      const state = await getState();
      const pending = state.pendingConnection;
      await updateState((s) => { delete s.pendingConnection; });
      // Only the site the user is looking at, as detected by the browser, can be connected.
      if (!m.approve || !pending || pending.origin !== m.origin || state.site.origin !== m.origin) return;
      await connectSite(m.origin, pending.partnerId);
      await addActivity({ kind: 'site_connected', title: pending.siteName, origin: m.origin });
      return startQuestFlow(pending.questId);
    }
    case 'CONNECTION_UPDATED':
      await disconnectSite(m.origin);
      await addActivity({ kind: 'site_disconnected', title: new URL(m.origin).host, origin: m.origin });
      return;
    case 'NOVA_REQUEST':
      return novaAsk(m.text, m.requestId);
    case 'NOVA_RESPONSE':
      return novaConfirm(m.confirmId, m.approve);
  }
}

async function handleContent(raw: unknown, tabId: number, origin: string): Promise<void> {
  const parsed = ContentMessageSchema.safeParse(raw);
  if (!parsed.success) throw new GamiError('invalid_message', 'Unrecognised message.');
  if (!firstTime(parsed.data.requestId)) return;
  await handleQuestEvent(parsed.data.event, { tabId, origin });
}

export async function route(raw: unknown, sender: chrome.runtime.MessageSender): Promise<Reply> {
  try {
    const extensionOrigin = chrome.runtime.getURL('').replace(/\/$/, '');
    const kind = classifySender({ id: sender.id, url: sender.url, tabId: sender.tab?.id }, chrome.runtime.id, extensionOrigin);
    if (kind === 'ui') await handleUi(raw);
    else if (kind === 'content' && sender.tab?.id !== undefined && sender.url && (sender.frameId ?? 0) === 0) {
      // Origin comes from the browser-supplied sender URL, not from the message body.
      await handleContent(raw, sender.tab.id, new URL(sender.url).origin);
    } else throw new GamiError('invalid_message', 'Sender not allowed.');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toErrorInfo(e) };
  }
}

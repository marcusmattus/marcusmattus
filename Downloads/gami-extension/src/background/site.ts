import { fetchQuests } from '../api/quests';
import { validateManifest } from '../schemas/manifest';
import { DetectionResultSchema, type ToContentMessage } from '../schemas/messages';
import { GamiError, toErrorInfo } from '../shared/errors';
import type { SiteState } from '../shared/types';
import { getSession, getState, updateState } from '../storage';
import { discoverWebMcpTools } from '../webmcp/discover';

async function setSite(site: SiteState, clearQuests = true): Promise<void> {
  await updateState((s) => {
    s.site = site;
    if (clearQuests) { s.quests = []; s.questsLoad = 'idle'; delete s.questsError; }
  });
}

export async function loadQuests(): Promise<void> {
  const state = await getState();
  const { origin, partnerId, status } = state.site;
  if (status !== 'supported' || !origin || !partnerId) return;
  await updateState((s) => { s.questsLoad = 'loading'; delete s.questsError; });
  try {
    const session = await getSession();
    const quests = await fetchQuests(session?.token ?? null, origin, partnerId);
    await updateState((s) => { if (s.site.origin === origin) { s.quests = quests; s.questsLoad = 'ready'; } });
  } catch (e) {
    if (e instanceof GamiError && (e.code === 'forbidden' || e.code === 'not_found')) {
      await setSite({ ...state.site, status: 'not_registered', detail: 'This site is not a registered Gami partner for this domain.' });
      return;
    }
    await updateState((s) => { s.questsLoad = 'error'; s.questsError = toErrorInfo(e); });
  }
}

/**
 * Inspect one tab, once, because the user asked. Requires the activeTab grant
 * the user gives by clicking the Gami toolbar button on that tab.
 */
export async function scanSite(tabId: number): Promise<void> {
  await setSite({ status: 'scanning', tabId });
  let url: string | undefined;
  try { url = (await chrome.tabs.get(tabId)).url; } catch { url = undefined; }
  if (!url) {
    await setSite({ status: 'restricted', tabId, detail: 'Click the Gami toolbar button on this tab so Gami can check it.' });
    return;
  }
  if (!/^https?:\/\//.test(url)) {
    await setSite({ status: 'restricted', tabId, detail: 'Gami cannot run on this kind of page.' });
    return;
  }
  const origin = new URL(url).origin;
  let raw: unknown;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    const msg: ToContentMessage = { type: 'SITE_DETECTED' };
    raw = await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    await setSite({ status: 'restricted', tabId, origin, detail: 'Click the Gami toolbar button on this tab so Gami can check it.' });
    return;
  }
  const detection = DetectionResultSchema.safeParse(raw);
  if (!detection.success) {
    await setSite({ status: 'error', tabId, origin, detail: 'The page check returned an unexpected result.' });
    return;
  }
  const d = detection.data;
  if (!d.enabledMeta && d.manifestMeta === null && d.manifest === null) {
    await setSite({ status: 'unsupported', tabId, origin });
    return;
  }
  if (d.manifest === null) {
    await setSite({ status: 'invalid_manifest', tabId, origin, detail: d.manifestError ?? 'The Gami manifest could not be loaded.' });
    return;
  }
  // `origin` comes from the browser's tab record, never from the page.
  const result = validateManifest(d.manifest, origin);
  if (!result.ok) {
    await setSite({ status: 'invalid_manifest', tabId, origin, detail: result.reason });
    return;
  }
  const m = result.manifest;
  await setSite({
    status: 'supported', tabId, origin, siteName: m.siteName, partnerId: m.partnerId,
    capabilities: m.capabilities ?? [], tools: discoverWebMcpTools(m.tools),
  });
  await loadQuests();
}

import { resolveManifestUrl } from '../schemas/manifest';
import { PageQuestEventSchema, ToContentMessageSchema, type ContentMessage, type DetectionResult } from '../schemas/messages';
import { EXTENSION_SOURCE, MANIFEST_TIMEOUT_MS } from '../shared/constants';

/**
 * Injected only into the tab the user invoked Gami on. It reads two <meta>
 * tags, fetches the site's own Gami manifest, and relays Gami quest events.
 * It reads nothing else from the page and records no input.
 */
const flag = globalThis as { __gamiContent?: boolean };

async function detect(): Promise<DetectionResult> {
  const enabledMeta = document.querySelector('meta[name="gami-enabled"]')?.getAttribute('content') === 'true';
  const manifestMeta = document.querySelector('meta[name="gami-manifest"]')?.getAttribute('content') ?? null;
  const result: DetectionResult = { enabledMeta, manifestMeta, manifest: null, manifestError: null };
  const url = resolveManifestUrl(manifestMeta, location.origin);
  if (!url) { result.manifestError = 'manifest path is not allowed'; return result; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { credentials: 'omit', cache: 'no-store', signal: controller.signal, redirect: 'error' });
    if (!res.ok) { if (enabledMeta || manifestMeta !== null) result.manifestError = `manifest returned ${res.status}`; return result; }
    const text = await res.text();
    if (text.length > 64_000) { result.manifestError = 'manifest is too large'; return result; }
    result.manifest = JSON.parse(text) as unknown;
  } catch {
    if (enabledMeta || manifestMeta !== null) result.manifestError = 'manifest could not be loaded';
  } finally {
    clearTimeout(timer);
  }
  return result;
}

if (!flag.__gamiContent) {
  flag.__gamiContent = true;
  const relayed = new Set<string>();

  chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || sender.tab) return false;
    const parsed = ToContentMessageSchema.safeParse(raw);
    if (!parsed.success) return false;
    if (parsed.data.type === 'SITE_DETECTED') {
      void detect().then(sendResponse);
      return true;
    }
    window.postMessage(
      { source: EXTENSION_SOURCE, type: 'GAMI_QUEST_STARTED', questId: parsed.data.questId, nonce: parsed.data.nonce },
      location.origin,
    );
    return false;
  });

  window.addEventListener('message', (ev: MessageEvent<unknown>) => {
    // Same window, same origin, exact schema. Everything else is ignored.
    if (ev.source !== window || ev.origin !== location.origin) return;
    const parsed = PageQuestEventSchema.safeParse(ev.data);
    if (!parsed.success || relayed.has(parsed.data.eventId)) return;
    relayed.add(parsed.data.eventId);
    const msg: ContentMessage = { requestId: crypto.randomUUID(), type: 'QUEST_COMPLETED', event: parsed.data };
    void chrome.runtime.sendMessage(msg).catch(() => undefined);
  });
}

import { z } from 'zod';

const EndpointSchema = z.object({ endpoint: z.string().url().max(2048) });

export const GamiSiteManifestSchema = z.object({
  version: z.literal('1'),
  partnerId: z.string().regex(/^[A-Za-z0-9_-]{3,64}$/),
  siteName: z.string().min(1).max(80),
  domains: z.array(z.string().regex(/^[a-z0-9.-]+$/i).max(253)).min(1).max(20),
  quests: EndpointSchema.optional(),
  mcp: EndpointSchema.optional(),
  capabilities: z.array(z.string().max(64)).max(32).optional(),
  publicKey: z.string().max(512).optional(),
  tools: z.array(z.unknown()).max(32).optional(),
});
export type GamiSiteManifest = z.infer<typeof GamiSiteManifestSchema>;

export type ManifestResult =
  | { ok: true; manifest: GamiSiteManifest }
  | { ok: false; reason: string };

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function checkEndpoint(endpoint: string, page: URL): string | null {
  let url: URL;
  try { url = new URL(endpoint); } catch { return 'endpoint is not a URL'; }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost(url.hostname))) {
    return `endpoint protocol ${url.protocol} is not allowed`;
  }
  if (url.origin !== page.origin) return 'endpoint must be on the same origin as the page';
  return null;
}

/**
 * A manifest is never trusted because the page served it. `pageOrigin` must
 * come from the browser (the tab's URL), not from the page or content script.
 * Partner registration is checked separately, by the Gami API.
 */
export function validateManifest(raw: unknown, pageOrigin: string): ManifestResult {
  let page: URL;
  try { page = new URL(pageOrigin); } catch { return { ok: false, reason: 'page origin is invalid' }; }
  if (page.protocol !== 'https:' && !(page.protocol === 'http:' && isLocalhost(page.hostname))) {
    return { ok: false, reason: 'page is not served over HTTPS' };
  }
  const parsed = GamiSiteManifestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'manifest does not match the schema' };
  const manifest = parsed.data;
  const host = page.hostname.toLowerCase();
  if (!manifest.domains.some((d) => d.toLowerCase() === host)) {
    return { ok: false, reason: 'manifest does not list this domain' };
  }
  for (const ep of [manifest.quests?.endpoint, manifest.mcp?.endpoint]) {
    if (ep === undefined) continue;
    const problem = checkEndpoint(ep, page);
    if (problem) return { ok: false, reason: problem };
  }
  return { ok: true, manifest };
}

/** The manifest path a page may point to: same-origin, absolute path only. */
export function resolveManifestUrl(metaContent: string | null, pageOrigin: string): string | null {
  const path = metaContent && metaContent.trim() !== '' ? metaContent.trim() : '/.well-known/gami.json';
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  try {
    const url = new URL(path, pageOrigin);
    return url.origin === new URL(pageOrigin).origin ? url.href : null;
  } catch { return null; }
}

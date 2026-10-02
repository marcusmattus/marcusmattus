import type { z } from 'zod';
import { config } from '../shared/config';
import { API_TIMEOUT_MS } from '../shared/constants';
import { GamiError } from '../shared/errors';

export type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  baseUrl?: string;
  timeoutMs?: number;
};

function assertBaseUrl(baseUrl: string): void {
  if (!baseUrl) throw new GamiError('not_configured', 'Service URL is not configured.');
  const url = new URL(baseUrl);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(config.devMock && local && url.protocol === 'http:')) {
    throw new GamiError('not_configured', 'Service URL must use HTTPS.');
  }
}

/**
 * JSON over HTTPS only. Responses are parsed as JSON and validated against a
 * zod schema; they are data and are never evaluated.
 */
export async function request<S extends z.ZodTypeAny>(path: string, schema: S, opts: RequestOptions = {}): Promise<z.infer<S>> {
  const baseUrl = opts.baseUrl ?? config.apiUrl;
  assertBaseUrl(baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? API_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new GamiError('timeout', 'Request timed out.');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new GamiError('offline', 'You are offline.');
    throw new GamiError('api_unavailable', 'Could not reach Gami.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let code = '';
    let message = '';
    try {
      const body = (await res.json()) as { error?: unknown; message?: unknown };
      if (typeof body.error === 'string') code = body.error;
      if (typeof body.message === 'string') message = body.message.slice(0, 200);
    } catch { /* non-JSON error body */ }
    if (res.status === 401) throw new GamiError('unauthorized', 'Session expired.');
    if (code === 'quest_expired') throw new GamiError('quest_expired', message || 'Quest expired.');
    if (code === 'already_completed') throw new GamiError('already_completed', message || 'Quest already completed.');
    if (code === 'quest_unavailable') throw new GamiError('quest_unavailable', message || 'Quest unavailable.');
    if (res.status === 403) throw new GamiError('forbidden', message || 'Not allowed.');
    if (res.status === 404) throw new GamiError('not_found', message || 'Not found.');
    if (res.status === 409) throw new GamiError('conflict', message || 'Conflict.');
    throw new GamiError('api_unavailable', message || `Gami returned ${res.status}.`);
  }
  let json: unknown;
  try { json = await res.json(); } catch { throw new GamiError('invalid_response', 'Gami sent an unreadable response.'); }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new GamiError('invalid_response', 'Gami sent an unexpected response.');
  return parsed.data as z.infer<S>;
}

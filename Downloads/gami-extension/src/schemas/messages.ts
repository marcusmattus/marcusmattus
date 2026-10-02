import { z } from 'zod';
import { PAGE_SOURCE } from '../shared/constants';

/** Page -> content script (window.postMessage). Untrusted. */
export const PageQuestEventSchema = z.object({
  source: z.literal(PAGE_SOURCE),
  type: z.literal('GAMI_QUEST_EVENT'),
  questId: z.string().min(1).max(128),
  eventId: z.string().min(1).max(128),
  nonce: z.string().min(16).max(128),
  timestamp: z.string().datetime(),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export type PageQuestEvent = z.infer<typeof PageQuestEventSchema>;

const requestId = z.string().min(8).max(64);
const base = { requestId };

/** Commands the extension's own pages (popup, side panel) may send. */
export const UiMessageSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('AUTH_STATUS'), session: z.object({ token: z.string().min(1), expiresAt: z.number() }).nullable() }),
  z.object({ ...base, type: z.literal('REFRESH') }),
  z.object({ ...base, type: z.literal('SCAN_SITE'), tabId: z.number().int().nonnegative() }),
  z.object({ ...base, type: z.literal('QUEST_STARTED'), questId: z.string().min(1).max(128) }),
  z.object({ ...base, type: z.literal('CONNECTION_REQUEST'), origin: z.string().url(), approve: z.boolean() }),
  z.object({ ...base, type: z.literal('CONNECTION_UPDATED'), origin: z.string().url(), action: z.literal('disconnect') }),
  z.object({ ...base, type: z.literal('NOVA_REQUEST'), text: z.string().min(1).max(500) }),
  z.object({ ...base, type: z.literal('NOVA_RESPONSE'), confirmId: z.string().min(1), approve: z.boolean() }),
]);
export type UiMessage = z.infer<typeof UiMessageSchema>;

/** Messages the injected content script may send. Nothing else is accepted from a tab. */
export const ContentMessageSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('QUEST_COMPLETED'), event: PageQuestEventSchema }),
]);
export type ContentMessage = z.infer<typeof ContentMessageSchema>;

/** Background -> content script. */
export const ToContentMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SITE_DETECTED') }),
  z.object({ type: z.literal('QUEST_PROGRESS'), questId: z.string(), nonce: z.string() }),
]);
export type ToContentMessage = z.infer<typeof ToContentMessageSchema>;

/** What the content script reports back from a detection run. */
export const DetectionResultSchema = z.object({
  enabledMeta: z.boolean(),
  manifestMeta: z.string().max(512).nullable(),
  manifest: z.unknown().nullable(),
  manifestError: z.string().max(200).nullable(),
});
export type DetectionResult = z.infer<typeof DetectionResultSchema>;

export type Reply = { ok: true } | { ok: false; error: { code: string; message: string } };

export type SenderInfo = { id?: string; url?: string; origin?: string; tabId?: number };

/** Classify who sent a runtime message. Anything unrecognised is rejected. */
export function classifySender(sender: SenderInfo, extensionId: string, extensionOrigin: string): 'ui' | 'content' | 'reject' {
  if (sender.id !== extensionId) return 'reject';
  const url = sender.url ?? '';
  if (url.startsWith(`${extensionOrigin}/`)) return 'ui';
  if (sender.tabId !== undefined && /^https?:\/\//.test(url)) return 'content';
  return 'reject';
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

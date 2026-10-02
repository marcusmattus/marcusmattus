export const SAFE_AGENT_SCOPES = [
  'profile:read', 'wallet:read', 'xp:read', 'points:read', 'rewards:read',
  'quests:read', 'quests:start', 'quests:submit', 'nova:use',
] as const;

/** Scopes NOVA must never hold. Rejected even if a credential claims them. */
export const FORBIDDEN_SCOPE_PATTERNS = [
  'transactions:sign', 'funds:transfer', 'wallet:export', 'treasury:spend', 'admin:',
] as const;

export const SITE_PERMISSIONS = ['quests:read', 'quests:start', 'quests:submit'] as const;

export const PAGE_SOURCE = 'gami-site';
export const EXTENSION_SOURCE = 'gami-extension';

export const STATE_KEY = 'gami:state';
export const SESSION_KEY = 'gami:session';
export const CONNECTIONS_KEY = 'gami:connections';
export const ACTIVITY_KEY = 'gami:activity';

export const API_TIMEOUT_MS = 10_000;
export const MANIFEST_TIMEOUT_MS = 5_000;
export const REWARD_POLL_INTERVAL_MS = 1_500;
export const REWARD_POLL_MAX_ATTEMPTS = 20;
export const MAX_ACTIVITY = 50;

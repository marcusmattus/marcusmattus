export type GamiErrorCode =
  | 'offline' | 'timeout' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict'
  | 'api_unavailable' | 'invalid_response' | 'invalid_message' | 'invalid_manifest'
  | 'permission_denied' | 'not_configured' | 'quest_unavailable' | 'quest_expired'
  | 'already_completed' | 'agent_denied' | 'unknown';

export class GamiError extends Error {
  constructor(public readonly code: GamiErrorCode, message: string) {
    super(message);
    this.name = 'GamiError';
  }
}

export type ErrorInfo = { code: GamiErrorCode; message: string };

export function toErrorInfo(e: unknown): ErrorInfo {
  if (e instanceof GamiError) return { code: e.code, message: e.message };
  return { code: 'unknown', message: e instanceof Error ? e.message : 'Something went wrong.' };
}

const USER_MESSAGES: Partial<Record<GamiErrorCode, string>> = {
  offline: 'You are offline. Reconnect and retry.',
  timeout: 'Gami took too long to respond. Retry.',
  unauthorized: 'Your session expired. Sign in again.',
  api_unavailable: 'Gami is unavailable right now. Retry shortly.',
  not_configured: 'This build is missing its service configuration.',
  permission_denied: 'Permission is needed for this site.',
  quest_expired: 'This quest has expired.',
  already_completed: 'You already completed this quest.',
  quest_unavailable: 'This quest is not available.',
};

export function userMessage(info: ErrorInfo): string {
  return USER_MESSAGES[info.code] ?? info.message;
}

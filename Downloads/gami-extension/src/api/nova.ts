import { GamiAgentCredentialSchema, NovaReplySchema, type GamiAgentCredential, type NovaReply } from '../schemas/agent';
import { config } from '../shared/config';
import { SAFE_AGENT_SCOPES } from '../shared/constants';
import { request } from './client';

/** Structured Gami context only. The web page itself is never sent. */
export type NovaContext = {
  origin: string | null;
  siteName: string | null;
  quests: { id: string; title: string; description: string; reward: string; status: string; verification: string }[];
  activeQuests: { questId: string; status: string }[];
  capabilities: string[];
  xp: number | null;
  level: number | null;
  nextLevelXp: number | null;
  points: number | null;
};

export function requestAgentCredential(token: string, origin: string | null): Promise<GamiAgentCredential> {
  return request('/agent/credential', GamiAgentCredentialSchema, {
    method: 'POST', token, body: { scopes: [...SAFE_AGENT_SCOPES], origin },
  });
}

export function askNova(credential: GamiAgentCredential, text: string, context: NovaContext, requestId: string): Promise<NovaReply> {
  return request('/chat', NovaReplySchema, {
    method: 'POST',
    baseUrl: config.novaUrl,
    token: credential.token,
    body: { requestId, agentSessionId: credential.sessionId, userId: credential.userId, walletAddress: credential.walletAddress, text, context },
    timeoutMs: 20_000,
  });
}

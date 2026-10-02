import { FORBIDDEN_SCOPE_PATTERNS } from '../shared/constants';
import type { GamiAgentCredential } from '../schemas/agent';

type ToolRule = { scope: string; confirm: boolean };

/** Gami MCP tools NOVA may call, the scope each needs, and whether the user must confirm. */
export const GAMI_MCP_TOOLS: Readonly<Record<string, ToolRule>> = {
  'gami.identity.get': { scope: 'profile:read', confirm: false },
  'gami.wallet.summary': { scope: 'wallet:read', confirm: false },
  'gami.xp.get': { scope: 'xp:read', confirm: false },
  'gami.level.get': { scope: 'xp:read', confirm: false },
  'gami.points.get': { scope: 'points:read', confirm: false },
  'gami.quests.list': { scope: 'quests:read', confirm: false },
  'gami.quests.get': { scope: 'quests:read', confirm: false },
  'gami.quests.start': { scope: 'quests:start', confirm: true },
  'gami.quests.submit': { scope: 'quests:submit', confirm: true },
  'gami.rewards.request': { scope: 'quests:submit', confirm: true },
  'gami.rewards.status': { scope: 'rewards:read', confirm: false },
  'gami.web.detect': { scope: 'quests:read', confirm: false },
  'gami.web.capabilities': { scope: 'quests:read', confirm: false },
  'gami.webmcp.tools': { scope: 'quests:read', confirm: false },
};

export function isForbiddenScope(scope: string): boolean {
  return FORBIDDEN_SCOPE_PATTERNS.some((p) => scope === p || scope.startsWith(p));
}

export type AgentDecision =
  | { ok: true; requiresConfirmation: boolean; scope: string }
  | { ok: false; reason: string };

/** Runs before any agent tool executes. Unknown tools are denied. */
export function authorizeAgentTool(
  credential: GamiAgentCredential | null,
  tool: string,
  opts: { now: number; userId: string; questId?: string },
): AgentDecision {
  if (!credential) return { ok: false, reason: 'no agent credential' };
  if (credential.userId !== opts.userId) return { ok: false, reason: 'credential belongs to another user' };
  if (Date.parse(credential.expiresAt) <= opts.now) return { ok: false, reason: 'agent credential expired' };
  const rule = Object.prototype.hasOwnProperty.call(GAMI_MCP_TOOLS, tool) ? GAMI_MCP_TOOLS[tool] : undefined;
  if (!rule) return { ok: false, reason: `tool ${tool} is not available to NOVA` };
  if (isForbiddenScope(rule.scope)) return { ok: false, reason: 'scope is never granted to NOVA' };
  if (!credential.scopes.includes(rule.scope)) return { ok: false, reason: `missing scope ${rule.scope}` };
  if (opts.questId !== undefined && credential.questIds && !credential.questIds.includes(opts.questId)) {
    return { ok: false, reason: 'quest is outside the credential' };
  }
  return { ok: true, requiresConfirmation: rule.confirm, scope: rule.scope };
}

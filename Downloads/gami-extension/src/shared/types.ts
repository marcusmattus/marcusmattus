import type { GamiIdentity, Balances } from '../schemas/identity';
import type { Quest, QuestReward } from '../schemas/quest';
import type { DiscoveredTool } from '../webmcp/discover';
import type { ErrorInfo } from './errors';
import type { QuestEvidence } from '../schemas/evidence';

export type SessionRecord = { token: string; expiresAt: number };

export type Load = 'idle' | 'loading' | 'ready' | 'error';

export type SiteStatus =
  | 'idle' | 'scanning' | 'supported' | 'unsupported' | 'restricted'
  | 'invalid_manifest' | 'not_registered' | 'error';

export type SiteState = {
  status: SiteStatus;
  tabId?: number;
  origin?: string;
  siteName?: string;
  partnerId?: string;
  capabilities?: string[];
  tools?: DiscoveredTool[];
  detail?: string;
};

export type ActiveQuestStatus =
  | 'started' | 'submitting' | 'pending' | 'reward_pending' | 'confirmed' | 'rejected' | 'error';

export type ActiveQuest = {
  questId: string;
  title: string;
  origin: string;
  tabId: number;
  startId: string;
  nonce: string;
  status: ActiveQuestStatus;
  reward: QuestReward;
  submissionId?: string;
  intentId?: string;
  /** Kept until confirmed so an interrupted submit can be retried with the same idempotency key. */
  evidence?: QuestEvidence;
  detail?: string;
  updatedAt: string;
};

export type NovaMessage = { id: string; role: 'user' | 'nova' | 'system'; text: string };
export type NovaConfirm = { confirmId: string; tool: string; questId: string; title: string };

export type AppState = {
  auth: { status: 'signed_out' | 'loading' | 'signed_in' | 'expired' | 'error'; error?: ErrorInfo };
  identity?: GamiIdentity;
  balances?: Balances;
  balancesLoad: Load;
  balancesError?: ErrorInfo;
  site: SiteState;
  quests: Quest[];
  questsLoad: Load;
  questsError?: ErrorInfo;
  active: Record<string, ActiveQuest>;
  pendingConnection?: { origin: string; siteName: string; partnerId?: string; questId: string };
  nova: { messages: NovaMessage[]; load: Load; error?: ErrorInfo; confirm?: NovaConfirm };
};

export type ActivityEntry = {
  id: string;
  at: string;
  kind: 'quest_started' | 'quest_submitted' | 'reward_confirmed' | 'quest_rejected' | 'site_connected' | 'site_disconnected';
  title: string;
  origin?: string;
  reward?: QuestReward;
};

export function initialState(): AppState {
  return {
    auth: { status: 'signed_out' },
    balancesLoad: 'idle',
    site: { status: 'idle' },
    quests: [],
    questsLoad: 'idle',
    active: {},
    nova: { messages: [], load: 'idle' },
  };
}

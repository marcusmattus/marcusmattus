import { RewardIntentSchema, type RewardIntent } from '../schemas/evidence';
import { request } from './client';

export function fetchReward(token: string, intentId: string): Promise<RewardIntent> {
  return request(`/rewards/${encodeURIComponent(intentId)}`, RewardIntentSchema, { token });
}

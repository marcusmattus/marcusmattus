import { GamiIdentitySchema, PointsSchema, XpSchema, type Balances, type GamiIdentity } from '../schemas/identity';
import { request } from './client';

export function fetchIdentity(token: string): Promise<GamiIdentity> {
  return request('/identity', GamiIdentitySchema, { token });
}

export async function fetchBalances(token: string): Promise<Balances> {
  const [xp, points] = await Promise.all([
    request('/xp', XpSchema, { token }),
    request('/points', PointsSchema, { token }),
  ]);
  return { ...xp, ...points };
}

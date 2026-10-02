import { SITE_PERMISSIONS } from '../shared/constants';
import { getConnections, setConnections } from '../storage';

export type SiteConnection = {
  origin: string;
  partnerId?: string;
  permissions: string[];
  createdAt: string;
  lastUsedAt: string;
};

export async function findConnection(origin: string): Promise<SiteConnection | undefined> {
  return (await getConnections()).find((c) => c.origin === origin);
}

/** Only ever called after the user approves the connection prompt. */
export async function connectSite(origin: string, partnerId: string | undefined): Promise<SiteConnection> {
  const now = new Date().toISOString();
  const list = (await getConnections()).filter((c) => c.origin !== origin);
  const conn: SiteConnection = { origin, partnerId, permissions: [...SITE_PERMISSIONS], createdAt: now, lastUsedAt: now };
  await setConnections([conn, ...list]);
  return conn;
}

export async function touchConnection(origin: string): Promise<void> {
  const list = await getConnections();
  await setConnections(list.map((c) => (c.origin === origin ? { ...c, lastUsedAt: new Date().toISOString() } : c)));
}

export async function disconnectSite(origin: string): Promise<void> {
  await setConnections((await getConnections()).filter((c) => c.origin !== origin));
}

export async function hasPermission(origin: string, permission: string): Promise<boolean> {
  const conn = await findConnection(origin);
  return conn !== undefined && conn.permissions.includes(permission);
}

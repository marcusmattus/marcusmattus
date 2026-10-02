const env = import.meta.env;

export const config = {
  apiUrl: (env.VITE_GAMI_API_URL ?? '').replace(/\/$/, ''),
  novaUrl: (env.VITE_NOVA_API_URL ?? '').replace(/\/$/, ''),
  mcpUrl: (env.VITE_GAMI_MCP_URL ?? '').replace(/\/$/, ''),
  privyAppId: env.VITE_PRIVY_APP_ID ?? '',
  privyClientId: env.VITE_PRIVY_CLIENT_ID ?? '',
  /** Development mock backend. package:chrome refuses to build with this on. */
  devMock: env.VITE_GAMI_DEV_MOCK === 'true',
} as const;

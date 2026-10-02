/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID?: string;
  readonly VITE_PRIVY_CLIENT_ID?: string;
  readonly VITE_GAMI_API_URL?: string;
  readonly VITE_GAMI_MCP_URL?: string;
  readonly VITE_NOVA_API_URL?: string;
  readonly VITE_GAMI_DEV_MOCK?: string;
}

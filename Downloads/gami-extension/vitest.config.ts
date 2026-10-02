import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    fileParallelism: false,
    env: {
      VITE_GAMI_API_URL: 'http://127.0.0.1:18787',
      VITE_NOVA_API_URL: 'http://127.0.0.1:18787/nova',
      VITE_GAMI_DEV_MOCK: 'true',
    },
  },
});

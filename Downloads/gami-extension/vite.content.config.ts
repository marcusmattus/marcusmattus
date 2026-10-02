import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// The content script is injected with chrome.scripting.executeScript, so it
// must be one classic script with no imports.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    target: 'chrome116',
    lib: { entry: resolve(import.meta.dirname, 'src/content/index.ts'), formats: ['iife'], name: 'GamiContent', fileName: () => 'content.js' },
  },
});

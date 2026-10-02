# Remote code

Gami does not execute remotely hosted JavaScript or WebAssembly. All executable extension code is packaged with the extension. Remote services return structured data only and responses are never evaluated as executable code.

## How this is enforced

- **Bundling.** Every dependency (React, Zustand, Zod, the Privy core SDK) is bundled by Vite into `dist/`. Fonts are bundled from `@fontsource`. No CDN is used.
- **CSP.** `manifest.json` sets `script-src 'self'; object-src 'self'` for extension pages, so the browser itself refuses remote or inline scripts.
- **Responses are data.** `src/api/client.ts` parses every response with `JSON` and validates it against a Zod schema before use. Site manifests are parsed and validated the same way (`src/schemas/manifest.ts`).
- **Injection.** The only injected script is the packaged `content.js`, by file name. No code strings are injected.
- **Build-time audit.** `npm run audit:remote-code` scans `src/` and the built `dist/` and fails on `eval(`, `new Function(`, string `Function(…)` calls, string `setTimeout`/`setInterval`, `import`/`importScripts` from `http(s)` URLs, remote `<script src>` and streaming WebAssembly. `package:chrome` runs it and refuses to produce a ZIP on failure. ESLint also enforces `no-eval`, `no-implied-eval` and `no-new-func`.
- **Zod 3** is used rather than Zod 4, because Zod 4 ships a `new Function` fast path.

## Notes for a reviewer

- `react-dom` contains code for rendering `<script>` elements that an app places in its JSX. Gami renders none, and the CSP would block a remote one.
- The Privy core SDK bundle contains URLs for Privy's API (`auth.privy.io`) and RPC endpoints. These are `fetch` targets for JSON, not script sources. Gami uses only Privy's email-code endpoints; it does not load Privy's embedded-wallet iframe or hosted UI.
- No WebAssembly is packaged.

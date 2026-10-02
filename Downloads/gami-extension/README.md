# Gami — Chrome extension

Quest the web. Earn with Gami.

**Single purpose:** discover and complete Gami quests on the website the user is currently visiting.

Manifest V3 · TypeScript (strict) · React · Vite · Zustand · Zod · Privy email sign-up.

## Status, plainly

Working and tested against the bundled mock backend: sign-up, session restore, identity, XP and points, site detection, manifest validation, quest start, signed completion, server verification, reward confirmation, XP update, duplicate protection, side panel, NOVA with scoped authorization, connected sites.

Not yet proven:

- **Privy sign-up against a real Privy app.** The code is written against `@privy-io/js-sdk-core` and typechecks, but needs your `VITE_PRIVY_APP_ID` to run.
- **The production Gami API and NOVA.** The client expects the endpoints listed below. If production differs, `src/api/` changes.
- **The toolbar-click path in real Chrome** is not covered by automation (no tool can click the toolbar button). Follow "Test it by hand".

Not built in this version: notifications, QR scanning, executing WebMCP tools (discovery only), a Gami MCP transport (the tool and scope table exists; calls go over REST).

## Architecture

```
popup / side panel (React)          background service worker             content script
  Privy sign-up (auth/)   ──AUTH──▶  auth.ts    identity, XP, points
  commands (ui/store.ts)  ──────▶    site.ts    activeTab scan ──inject──▶ reads 2 meta tags,
  reads state from                   quests.ts  start, submit, poll        fetches the site's
  chrome.storage.session  ◀─state──  nova.ts    scoped assistant           gami.json, relays
                                     messages.ts  validates every message ◀─ quest events
                                          │
                                          ▼  HTTPS JSON, Zod-validated
                                     Gami API · NOVA API
```

- The worker is the only writer of app state; the UI mirrors `chrome.storage.session`. A worker restart loses nothing.
- Privy runs in the popup and side panel (it needs `localStorage`); the worker receives only the access token and its expiry.
- The content script is injected on demand into the invoked tab. There are no static content scripts and no host permissions.

## Quest lifecycle

```
QUEST → EVIDENCE → VERIFICATION → REWARD INTENT → CONFIRMATION
```

1. User opens Gami on a site. The worker injects the detector, validates the manifest against the tab's real origin, and asks the Gami API for that partner's quests. The API is the source of truth; the site's manifest is never trusted for rewards.
2. User starts a quest. First time on a site, they approve a connection. The API issues a `startId` and a nonce; the nonce is passed to the page.
3. The user does the action. **The partner's backend** signs `(questId, origin, eventId, nonce, timestamp)` and the page posts it.
4. The content script relays it. The worker checks tab, origin, nonce and state, then submits with `Idempotency-Key: questId:userId:startId`.
5. The API verifies the signature and creates a reward intent. The worker polls until `confirmed`, then refreshes XP. The UI shows a reward as final only then.

A click, a URL, DOM text or a timestamp is never proof. Replays, refreshes, retries and worker restarts reuse the same key and cannot produce a second reward.

## Requirements

Node 20+, Chrome 116+.

## Install and run locally

```bash
npm install
cp .env.development.local.example .env.development.local
npm run dev        # mock API :8787, test site :8788, watch build into dist/
```

Load it: `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`.

### Test it by hand

1. Open `http://localhost:8788`.
2. Click the Gami toolbar button. Sign up with any email; the development code is `000000`.
3. The popup shows LEVEL 04, 1,250 XP, 820 points, "1 QUEST AVAILABLE", and **Complete Test Quest +100 XP**.
4. Press **OPEN SIDE PANEL**, then **START QUEST**, then **CONNECT**.
5. On the page, press **COMPLETE TEST ACTION**.
6. The quest card moves through verification pending to **QUEST COMPLETE +100 XP**; XP becomes 1,350.
7. Try: NOVA ("What can I earn here?", "Start this quest", "transfer my funds"), Settings → Disconnect, an ordinary site (no quests found), `chrome://extensions` (cannot run here).

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_PRIVY_APP_ID` | Your Privy app ID. Required for production. |
| `VITE_PRIVY_CLIENT_ID` | Optional Privy app client ID. |
| `VITE_GAMI_API_URL` | Gami API base URL. HTTPS. |
| `VITE_NOVA_API_URL` | NOVA API base URL. HTTPS. |
| `VITE_GAMI_MCP_URL` | Reserved for the Gami MCP transport. Unused in this version. |
| `VITE_GAMI_DEV_MOCK` | `true` only in development. Selects the mock sign-in and allows `http://localhost`. `package:chrome` refuses to run with it on and checks the bundle for mock code. |

No secrets belong in these files: everything `VITE_` is public in the bundle.

## Privy setup

1. Create an app at Privy and enable **Email** login.
2. Add `chrome-extension://<your-extension-id>` to the app's allowed origins (the ID is stable once published; for an unpacked build, set a `key` in the manifest or add the dev ID).
3. If you enable CAPTCHA for email codes, sign-up will fail: the extension does not yet pass a CAPTCHA token.
4. The Gami API must verify the Privy access token on every request and map the Privy user to a Gami identity and wallet. The verification keys for the Gami Privy app are published at `https://auth.privy.io/api/v1/apps/cmrz2f6jc01560djmtczc288n/jwks.json`; this is configured on the API server, not in the extension.

The extension uses Privy's headless core SDK for email codes only. It does not load Privy's hosted UI or embedded-wallet iframe, and never holds a private key.

## Gami API contract the extension expects

All JSON; `Authorization: Bearer <Privy access token>`; CORS must allow the extension origin.

| Endpoint | Returns |
|---|---|
| `GET /identity` | `{ id, privyUserId, walletAddress, network: "gami-1" }` |
| `GET /xp` | `{ xp, level, nextLevelXp? }` |
| `GET /points` | `{ points }` |
| `GET /quests?origin=&partnerId=` | `{ quests: Quest[] }`; 403/404 if the partner is not registered for the origin |
| `POST /quests/:id/start` `{ origin }` | `{ startId, nonce, expiresAt }` |
| `POST /quests/:id/submit` `{ startId, evidence[] }` + `Idempotency-Key` | `{ submissionId, questId, status, rewardIntentId?, reason? }` |
| `GET /rewards/:intentId` | `RewardIntent` |
| `POST /agent/credential` `{ scopes, origin }` | `GamiAgentCredential` plus `token` |
| `POST {NOVA}/chat` | `{ reply, toolRequest? }` |

Schemas: `src/schemas/`. Reference implementation: `dev/mock-server.mjs`.

## Making a site Gami-enabled

See `examples/gami-test-site/`: two meta tags, `/.well-known/gami.json`, a listener for `GAMI_QUEST_STARTED`, and a backend that signs completions. Manifest endpoints must be HTTPS and same-origin, and `domains` must include the host.

## WebMCP and NOVA

WebMCP is what the *site* exposes; Gami MCP is what *Gami* exposes. In this version a site declares tools in its manifest (`tools`); Gami validates and lists them, marks `transaction` and `sensitive` tools blocked, and executes none.

NOVA receives structured context only (site name, quests, XP, level, points, reward status), never the page. It runs under a short-lived credential with these scopes: `profile:read wallet:read xp:read points:read rewards:read quests:read quests:start quests:submit nova:use`. Every tool request passes `authorizeAgentTool` (`src/permissions/scopes.ts`): unknown tools, missing scopes, expired credentials and anything touching signing, transfers, export, treasury or admin are denied. Starting a quest needs the user's Confirm.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Mock backend + watch build |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` / `lint` | TypeScript strict / ESLint |
| `npm run test` | All tests (57) against the mock backend |
| `npm run test:security` | Security tests only |
| `npm run test:smoke` | Loads the dev build in real Chromium (needs `CHROMIUM_PATH` or an installed Chromium) |
| `npm run audit:permissions` | Manifest permission audit |
| `npm run audit:remote-code` | Remote-code audit of `src/` and `dist/` |
| `npm run package:chrome` | Production build, both audits, mock-code check, ZIP into `release/` |

## Permissions, privacy, security

`docs/PERMISSIONS.md`, `docs/REMOTE_CODE.md`, `docs/PRIVACY_POLICY.md`, `docs/CHROME_WEB_STORE.md`.

## Packaging

`npm run package:chrome` writes `release/gami-extension-<version>.zip` containing only `dist/`. Without production configuration the file is named `…-UNCONFIGURED.zip` and must not be submitted.

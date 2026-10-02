# Chrome Web Store submission text

## Name
Gami

## Summary (132 characters max)
Quest the web. Earn with Gami. Discover and complete Gami quests on the website you are visiting.

## Single purpose
Gami helps users discover and complete Gami Protocol quests on the website they are currently visiting. The extension checks the active tab for Gami-enabled quest metadata or supported Gami integrations, displays available quests in the extension or side panel, allows the user to start or submit quest activity, and shows resulting XP or reward status.

## Permission justifications

**storage**
The storage permission saves extension preferences and Gami-specific state, including connected-site permissions, safe session references, quest state and a local activity log. It is not used to store wallet private keys, seed phrases or passwords.

**activeTab**
The activeTab permission allows Gami to inspect the webpage the user is currently viewing when the user invokes the extension. It is used to determine whether the current page supports Gami quests and is not used to continuously monitor browsing history.

**scripting**
The scripting permission allows Gami to run its packaged page-detection script on the current active tab when requested by the user. It detects Gami quest metadata and supported integration markers. No remote scripts are executed.

**sidePanel**
The sidePanel permission provides a persistent interface for viewing and completing Gami quests while the user remains on the active website.

**notifications**
Not requested. Do not include a justification.

**Host permissions**
None requested.

## Remote code
"No, I am not using remote code." All JavaScript is packaged. See `docs/REMOTE_CODE.md`.

## Data usage disclosures (Privacy practices tab)

Tick these, and only these:

| Category | Collected? | What and why |
|---|---|---|
| Personally identifiable information | Yes | Email address, sent to Privy to sign up / sign in. |
| Authentication information | Yes | Privy session tokens, kept on the device and sent to Gami to authenticate requests. |
| User activity | Yes | Gami quest actions only: quest started, evidence submitted, reward status. |
| Web history | Yes (limited) | The origin (for example `https://example.com`) of a site, sent to Gami **only** when the user opens Gami on a site that publishes a Gami manifest. Not a browsing history. |
| Website content | No | Only Gami's own `<meta>` tags and the site's Gami manifest are read. |
| Health, financial and payment, personal communications, location | No | |

Certify all three: data is not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used or transferred to determine creditworthiness or for lending.

## Privacy policy URL
https://gamiprotocol.io/legal/chrome-extension-privacy (publish `docs/website/chrome-extension-privacy.md` there before submitting).

## Before you submit

1. Set `VITE_PRIVY_APP_ID`, `VITE_GAMI_API_URL`, `VITE_NOVA_API_URL` in `.env.production`; run `npm run package:chrome`. The ZIP must not end in `-UNCONFIGURED`.
2. In the Privy dashboard, add `chrome-extension://<published-id>` as an allowed origin and enable email login.
3. Confirm the Gami and NOVA APIs send CORS headers for that origin.
4. Supply reviewer test instructions: a Gami-enabled URL and a test email that can receive a code.
5. Replace the bracketed placeholders in the privacy policy.

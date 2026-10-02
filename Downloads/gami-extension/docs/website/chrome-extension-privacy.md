---
title: Gami Chrome Extension Privacy Policy
path: /legal/chrome-extension-privacy
---
# Gami Chrome Extension Privacy Policy


Effective date: [EFFECTIVE DATE]

This policy describes what the Gami Chrome extension ("Gami") does with data. It is written to match the extension's code, version 0.1.0.

## What the extension does

Gami lets you discover and complete Gami Protocol quests on the website you are visiting, and shows your XP, Universal Points and reward status.

## When Gami looks at a page

Gami looks at a page only when you ask: by clicking the Gami toolbar button, or by pressing Scan in the side panel on a tab where you have clicked that button. It does not run on pages in the background and has no access to sites you have not invoked it on.

When it looks, a script packaged with the extension:

- reads two `<meta>` tags (`gami-enabled`, `gami-manifest`);
- requests that site's own Gami manifest (`/.well-known/gami.json`), without cookies;
- listens for Gami quest-completion messages that the site itself posts.

This happens on your device. If the site has no valid Gami manifest, nothing about the page is sent to Gami.

## Data Gami collects

| Data | When | Sent to | Why |
|---|---|---|---|
| Email address | Sign up / sign in | Privy | To send you a one-time code and identify your account |
| Session tokens | After sign-in | Stored on your device; the access token is sent to Gami with each request | To authenticate you |
| Gami identity: user ID, public wallet address, XP, level, Universal Points | After sign-in | Received from Gami | To show your account |
| Site origin and partner ID | When you open Gami on a site with a valid Gami manifest | Gami | To check the site is a registered partner and list its quests |
| Quest activity: quest ID, start, the site's signed completion proof (event ID, nonce, timestamp, signature) | When you start and complete a quest | Gami | To verify the quest and issue the reward |
| NOVA questions and Gami context: your question, the site name and origin, its quests, your XP, level, points and reward status | When you send NOVA a message | Gami (NOVA service) | To answer questions about quests |

## Data Gami does not collect

Gami does not collect your browsing history, keystrokes, mouse movements, passwords, the content of pages you visit, emails or private messages, health information, or precise location. Gami never has, stores or transmits wallet private keys or seed phrases. The contents of a web page are not sent to NOVA.

## Storage on your device

- **Session storage (cleared when the browser closes):** interface state, quests in progress, the current access token, and a pending sign-in email.
- **Local storage:** sites you have connected and their permissions; an activity log of your last 50 Gami events (quest titles, site origins, times); Privy's session tokens for the extension.

Signing out deletes the session data, the activity log and Privy's tokens. Connected sites remain until you disconnect them or remove the extension. Removing the extension deletes everything it stored.

## Connected sites

A site is connected only when you approve the prompt the first time you start one of its quests. A connection grants three permissions: read, start and submit quests for that site. Settings lists every connected site, its permissions and the date, and lets you disconnect it.

## NOVA

NOVA is a quest assistant. It works under a short-lived credential limited to reading your Gami profile, wallet address, XP, points, rewards and quests, and starting or submitting quests. It cannot sign transactions, transfer funds or export a wallet. It cannot start a quest unless you press Confirm.

## Retention

[RETENTION PERIODS FOR ACCOUNT, QUEST AND NOVA DATA HELD ON GAMI SERVERS]

## Security

All service requests use HTTPS. Responses are validated before use and never executed as code. Rewards are issued only after server-side verification.

## Third-party processors

- **Privy** — authentication. [LINK TO PRIVY PRIVACY POLICY]
- [HOSTING AND AI PROVIDERS USED BY THE GAMI API AND NOVA]

## Your controls and deletion

You can sign out, disconnect sites, and remove the extension at any time. To delete your Gami account and server-side data, contact [PRIVACY CONTACT EMAIL].

## Chrome Web Store Limited Use

Gami's use and transfer of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. Data is used only to provide the quest features described here. It is not sold, not used for advertising, not used to determine creditworthiness, and not read by humans except with your consent, for security, or to comply with law.

## Changes and contact

We will post changes here and update the effective date. Contact: [COMPANY LEGAL NAME], [ADDRESS], [PRIVACY CONTACT EMAIL].

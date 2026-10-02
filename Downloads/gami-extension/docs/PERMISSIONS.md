# Permissions

The manifest requests four permissions and no host permissions. `npm run audit:permissions` fails the build if a permission is requested but unused, if a forbidden permission appears, or if code calls an API whose permission is not declared.

| Permission | Where it is used | Why it is required | What breaks without it | Narrower alternative |
|---|---|---|---|---|
| `storage` | `src/storage/index.ts`, `src/ui/store.ts`, `src/ui/useAuth.ts` | `chrome.storage.session` holds UI state and the short-lived access token (memory only, cleared when the browser closes). `chrome.storage.local` holds connected sites and the local activity log. | State is lost each time the service worker sleeps; quests in progress, connected sites and sign-in cannot survive. | None. This is the narrowest storage API for an MV3 worker. |
| `activeTab` | `src/background/site.ts` (`chrome.tabs.get`, `chrome.scripting.executeScript`) | Grants temporary access to the one tab the user is on, only when they click the Gami toolbar button. Used to read the tab's URL and inject the packaged detector. | Gami could not see which site the user is on or detect Gami metadata. | This is the narrow alternative: it replaces `tabs` and `<all_urls>` host permissions. |
| `scripting` | `src/background/site.ts` | Injects the packaged `content.js` into the active tab on user invocation. It reads two `<meta>` tags, fetches the site's own `/.well-known/gami.json`, and relays Gami quest events. | No site detection and no quest completion events. | A static `content_scripts` entry would need host permissions on every site, which is broader. |
| `sidePanel` | `src/popup/App.tsx` (`chrome.sidePanel.open`), `side_panel` manifest key | Shows quests, NOVA, rewards and settings beside the page while the user completes a quest. | No persistent quest UI; the popup closes when the user clicks the page. | None. |

## Permissions deliberately not requested

| Permission | Why it is absent |
|---|---|
| `tabs` | `activeTab` gives the URL of the invoked tab. `chrome.tabs.query`, `tabs.sendMessage`, `tabs.onActivated` and `tabs.onUpdated` work without it (they return no URLs). |
| host permissions / `<all_urls>` | Not needed. The Gami API and Privy are reached with ordinary CORS requests. **The Gami API and NOVA API must therefore send CORS headers allowing the extension origin** (`chrome-extension://<id>`). |
| `identity` | Sign-up uses Privy email codes, not `chrome.identity`. |
| `alarms` | There is no scheduled background work. Reward polling runs only while a quest is being verified, and resumes when the user opens Gami. |
| `notifications` | Notifications are not implemented in this version. |
| `history`, `webRequest`, `cookies`, `management`, `downloads`, `debugger`, `webNavigation` | Unrelated to the single purpose. |

There are no `content_scripts`, `externally_connectable`, `web_accessible_resources` or optional permissions.

## A consequence worth knowing

Because access is per-invocation, the side panel cannot see a new page after the user navigates or switches tabs. It shows "Page changed" and asks the user to scan; if the grant has lapsed it asks them to click the toolbar button. This is the cost of not requesting broad host access.

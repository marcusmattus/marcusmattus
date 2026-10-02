import { route } from './messages';

// Only messages from this extension's own pages and its injected content
// script are handled. No onMessageExternal / onConnectExternal listeners
// exist, so web pages and other extensions cannot message the worker.
chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  void route(raw, sender).then(sendResponse);
  return true;
});

// What a Gami partner site does:
// 1. The extension tells the page a quest was started and gives it a nonce.
// 2. When the user completes the action, the site's OWN backend signs it.
// 3. The page posts that signed event; the extension relays it to Gami,
//    and the Gami server verifies the signature. The browser proves nothing.
let started = null;
const status = document.getElementById('status');

window.addEventListener('message', (ev) => {
  if (ev.source !== window || ev.origin !== location.origin) return;
  const d = ev.data;
  if (d && d.source === 'gami-extension' && d.type === 'GAMI_QUEST_STARTED') {
    started = { questId: d.questId, nonce: d.nonce };
    status.textContent = 'Quest started. Press the button to complete it.';
  }
});

document.getElementById('complete').addEventListener('click', async () => {
  if (!started) { status.textContent = 'Start the quest in the Gami extension first.'; return; }
  const res = await fetch('/api/gami/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(started) });
  if (!res.ok) { status.textContent = 'The site could not record the action.'; return; }
  const proof = await res.json();
  window.postMessage({ source: 'gami-site', type: 'GAMI_QUEST_EVENT', questId: started.questId, nonce: started.nonce, ...proof }, location.origin);
  status.textContent = 'Action recorded. Check the Gami extension for verification.';
});

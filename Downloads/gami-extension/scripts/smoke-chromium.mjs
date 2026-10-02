// Optional: loads the DEV build (npm run build:dev) in real Chromium and checks
// that the extension loads, the worker registers, and dev sign-up reaches the
// signed-in popup. It cannot click the toolbar button, so the activeTab
// detection path is NOT covered here: test that by hand (README).
import { chromium } from 'playwright-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startMock } from '../dev/mock-server.mjs';

const mock = await startMock();
const dist = resolve('dist');
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'gami-')), {
  channel: 'chromium', headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
let failed = false;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed = true; };
try {
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(sw.url()).host;
  check('service worker registered', sw.url().endsWith('/background.js'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.getByRole('button', { name: 'SIGN UP WITH EMAIL' }).waitFor({ timeout: 10000 });
  check('popup renders signed-out screen', true);
  await page.getByLabel('EMAIL').fill('smoke@example.com');
  await page.getByRole('button', { name: 'SIGN UP WITH EMAIL' }).click();
  await page.getByPlaceholder('6-digit code').fill('000000');
  await page.getByRole('button', { name: 'CONFIRM CODE' }).click();
  await page.getByText('1,250').waitFor({ timeout: 10000 });
  check('dev sign-up loads identity, XP 1,250 and points 820', await page.getByText('820').isVisible());
  check('level shown in header', await page.getByText('04', { exact: true }).isVisible());
  const panel = await ctx.newPage();
  await panel.goto(`chrome-extension://${id}/sidepanel.html`);
  await panel.getByRole('tab', { name: 'SETTINGS' }).click();
  check('side panel restores the session and shows Settings', await panel.getByText('Privy', { exact: true }).isVisible());
  await panel.getByRole('button', { name: 'SIGN OUT' }).click();
  await panel.getByRole('button', { name: 'SIGN UP WITH EMAIL' }).waitFor({ timeout: 10000 });
  check('sign out returns to the signed-out screen', true);
  check(`no page errors (${errors.length})`, errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
} catch (e) { console.error(e); failed = true; } finally { await ctx.close(); await mock.close(); }
process.exit(failed ? 1 : 0);

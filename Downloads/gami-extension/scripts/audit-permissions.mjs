// Fails if the manifest asks for anything the code does not use, or anything forbidden.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = walk('src').filter((f) => /\.tsx?$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');

const USAGE = {
  storage: /chrome\.storage\./,
  activeTab: /chrome\.tabs\.get\(|chrome\.scripting\.executeScript/,
  scripting: /chrome\.scripting\./,
  sidePanel: /chrome\.sidePanel\./,
  notifications: /chrome\.notifications\./,
};
const FORBIDDEN = ['tabs', 'identity', 'alarms', 'history', 'webRequest', 'cookies', 'management', 'downloads', 'debugger', 'webNavigation', 'browsingData', 'clipboardRead', 'nativeMessaging'];
const API_NEEDS = { alarms: /chrome\.alarms\./, identity: /chrome\.identity\./, cookies: /chrome\.cookies\./, history: /chrome\.history\./, webRequest: /chrome\.webRequest\./, downloads: /chrome\.downloads\./, management: /chrome\.management\./, debugger: /chrome\.debugger\./, notifications: /chrome\.notifications\./ };

let failed = false;
const fail = (m) => { console.error(`FAIL  ${m}`); failed = true; };

for (const file of ['public/manifest.json', 'dist/manifest.json'].filter(existsSync)) {
  const m = JSON.parse(readFileSync(file, 'utf8'));
  const perms = m.permissions ?? [];
  console.log(`${file}: permissions = ${JSON.stringify(perms)}`);
  for (const p of perms) {
    if (FORBIDDEN.includes(p)) fail(`${file}: forbidden permission "${p}"`);
    else if (!USAGE[p]) fail(`${file}: permission "${p}" has no known justification`);
    else if (!USAGE[p].test(src)) fail(`${file}: permission "${p}" is requested but never used in src/`);
    else console.log(`  ok  ${p} is used`);
  }
  for (const key of ['host_permissions', 'optional_host_permissions', 'content_scripts', 'externally_connectable', 'web_accessible_resources', 'optional_permissions']) {
    if (m[key] && (Array.isArray(m[key]) ? m[key].length : Object.keys(m[key]).length)) fail(`${file}: "${key}" must be empty in V1`);
  }
  if (JSON.stringify(m).includes('<all_urls>')) fail(`${file}: <all_urls> is not allowed`);
  if (m.manifest_version !== 3) fail(`${file}: must be Manifest V3`);
  for (const [perm, re] of Object.entries(API_NEEDS)) if (re.test(src) && !perms.includes(perm)) fail(`src/ uses chrome.${perm} but "${perm}" is not declared`);
}
if (failed) process.exit(1);
console.log('Permission audit passed.');

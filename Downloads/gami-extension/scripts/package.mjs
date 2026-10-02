// Builds a production bundle and zips ONLY dist/ for the Chrome Web Store.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('VITE_'))) };
if (env.VITE_GAMI_DEV_MOCK === 'true') { console.error('Refusing to package: VITE_GAMI_DEV_MOCK=true.'); process.exit(1); }
const missing = ['VITE_PRIVY_APP_ID', 'VITE_GAMI_API_URL', 'VITE_NOVA_API_URL'].filter((k) => !env[k]);
const insecure = ['VITE_GAMI_API_URL', 'VITE_NOVA_API_URL', 'VITE_GAMI_MCP_URL'].filter((k) => env[k] && !env[k].startsWith('https://'));
if (insecure.length) { console.error(`Refusing to package: ${insecure.join(', ')} must be https://`); process.exit(1); }

const run = (cmd) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, VITE_GAMI_DEV_MOCK: 'false' } });
run('npx tsc --noEmit');
run('npx vite build --mode production');
run('npx vite build --mode production -c vite.content.config.ts');
run('node scripts/audit-permissions.mjs');
run('node scripts/audit-remote-code.mjs');

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk('dist');
const bad = files.filter((f) => /\.map$|\.env|\.test\.|mock/i.test(f));
if (bad.length) { console.error(`Refusing to package, unexpected files: ${bad.join(', ')}`); process.exit(1); }
for (const f of files.filter((x) => x.endsWith('.js'))) {
  const text = readFileSync(f, 'utf8');
  for (const marker of ['/dev/login', '/dev/send-code', 'gami:dev-session', 'localhost:8787']) {
    if (text.includes(marker)) { console.error(`Refusing to package: development mock code found in ${f} (${marker}).`); process.exit(1); }
  }
}
const version = JSON.parse(readFileSync('dist/manifest.json', 'utf8')).version;
mkdirSync('release', { recursive: true });
const name = `gami-extension-${version}${missing.length ? '-UNCONFIGURED' : ''}.zip`;
rmSync(join('release', name), { force: true });
execSync(`cd dist && zip -qr ../release/${name} .`);
console.log(`\nPackaged release/${name} (${files.length} files).`);
if (missing.length) {
  console.warn(`\nWARNING: ${missing.join(', ')} not set. This ZIP is NOT submittable: sign-up and the Gami API will show "not configured". Set them in .env.production and re-run.`);
}

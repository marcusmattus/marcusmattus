// Fails if source or built output could execute remotely hosted code.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const RULES = [
  ['eval(', /(^|[^.\w$])eval\s*\(/],
  ['new Function(', /new\s+Function\s*\(/],
  ['Function constructor call', /(^|[^.\w$])Function\s*\(\s*["'`]/],
  ['import from URL', /import\s*(\(|[^;]*from)\s*["'`]https?:/],
  ['importScripts from URL', /importScripts\s*\(\s*["'`]https?:/],
  ['remote <script>', /<script[^>]+src\s*=\s*["']?(https?:)?\/\//i],
  ['setTimeout/setInterval with string', /set(Timeout|Interval)\s*\(\s*["'`]/],
  ['remote WebAssembly', /WebAssembly\.(instantiateStreaming|compileStreaming)/],
];
const targets = [
  ...walk('src'),
  ...['popup.html', 'sidepanel.html'],
  ...(existsSync('dist') ? walk('dist') : []),
].filter((f) => /\.(ts|tsx|js|mjs|html)$/.test(f));

let failed = false;
for (const file of targets) {
  const text = readFileSync(file, 'utf8');
  for (const [name, re] of RULES) {
    const m = re.exec(text);
    if (m) { console.error(`FAIL  ${file}: ${name}  …${text.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, ' ')}…`); failed = true; }
  }
}
if (existsSync('dist')) {
  const wasm = walk('dist').filter((f) => f.endsWith('.wasm'));
  if (wasm.length) console.log(`note: packaged WebAssembly: ${wasm.join(', ')}`);
}
console.log(`Scanned ${targets.length} files${existsSync('dist') ? ' (src + dist)' : ' (src only: run a build to scan dist)'}.`);
if (failed) process.exit(1);
console.log('Remote-code audit passed.');

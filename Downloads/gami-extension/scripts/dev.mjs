// Mock backend + watch builds, using .env.development.local (see README).
import { spawn } from 'node:child_process';
const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit' });
const procs = [
  run('node', ['dev/mock-server.mjs']),
  run('npx', ['vite', 'build', '--watch', '--mode', 'development']),
];
// The content build must not race the main build's emptyOutDir.
setTimeout(() => procs.push(run('npx', ['vite', 'build', '--watch', '--mode', 'development', '-c', 'vite.content.config.ts'])), 6000);
process.on('SIGINT', () => { procs.forEach((p) => p.kill()); process.exit(0); });

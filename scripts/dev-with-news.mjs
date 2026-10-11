import { spawn } from 'node:child_process';
import path from 'node:path';
const children = [
  spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'dev', ...process.argv.slice(2)], { stdio: 'inherit' }),
  spawn(process.execPath, [path.resolve('scripts/news/fetch-kantipur.mjs'), '--watch'], { stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return; stopping = true; process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

import { collectKantipur } from '../../lib/news/collect.mjs';

async function run() {
  try { console.log('Kantipur collection:', await collectKantipur()); }
  catch (error) { console.error('Collection failed:', error.message); if (!process.argv.includes('--watch')) process.exitCode = 1; }
}
await run();
if (process.argv.includes('--watch')) {
  console.log('Checking Kantipur every 30 minutes. Press Ctrl+C to stop.');
  // Sequential loop prevents overlapping runs.
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
    await run();
  }
}

// Save /digest/<night> as one self-contained HTML file (a command, not a browser "save as").
// Usage: pnpm save:digest <night> [out.html]   (env: .env respected, same as dev)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const night = process.argv[2];
if (!night || !/^\d{4}-\d{2}-\d{2}$/.test(night)) {
  console.error('usage: pnpm save:digest <YYYY-MM-DD> [out.html]');
  process.exit(2);
}
const out = process.argv[3] ?? `preview-${night}.html`;

const res = await createApp(loadConfig()).request(`/digest/${night}`);
if (res.status !== 200) {
  console.error(`digest for ${night} not rendered: ${res.status}`);
  process.exit(1);
}
const html = await res.text();
mkdirSync(dirname(out) === '' ? '.' : dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out}: ${html.length} bytes, marker ${process.env.LANE_MARKER ? 'on' : 'off'}`);

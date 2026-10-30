import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LogLine } from './types.js';

export type NightCounts = { ok: number; retry: number; fail: number; bad: number };

// ok / retry / fail per line of one night's log. Bad lines are counted, never thrown.
// Null when the night has no file yet.
export function nightCounts(runsDir: string, night: string): NightCounts | null {
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;

  const counts: NightCounts = { ok: 0, retry: 0, fail: 0, bad: 0 };
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    let parsed: LogLine;
    try {
      parsed = JSON.parse(line) as LogLine;
    } catch {
      counts.bad += 1;
      continue;
    }
    if (parsed.status === 'ok') counts.ok += 1;
    else if (parsed.status === 'retry') counts.retry += 1;
    else if (parsed.status === 'fail') counts.fail += 1;
    else counts.bad += 1;
  }
  return counts;
}

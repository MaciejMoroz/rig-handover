import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, LogLine } from './types.js';

// One night's run log, aggregated per job. Null when the night has no file yet.
export function readNight(runsDir: string, night: string): DigestRow[] | null {
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;

  const rows = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    let parsed: LogLine;
    try {
      parsed = JSON.parse(line) as LogLine;
    } catch {
      badLines += 1;
      continue;
    }
    let row = rows.get(parsed.job);
    if (!row) {
      row = {
        job: parsed.job,
        owner: parsed.owner ?? null,
        runs: 0,
        retries: 0,
        lastStatus: parsed.status,
        lastError: null,
        firstAt: parsed.at,
        lastAt: parsed.at,
        badLines: 0,
      };
      rows.set(parsed.job, row);
    }
    row.runs += 1;
    if (parsed.status === 'retry') row.retries += 1;
    row.lastStatus = parsed.status;
    row.lastAt = parsed.at;
    if (parsed.error !== undefined) row.lastError = parsed.error;
  }

  const digest = [...rows.values()].sort((a, b) => a.job.localeCompare(b.job));
  for (const row of digest) row.badLines = badLines;
  return digest;
}

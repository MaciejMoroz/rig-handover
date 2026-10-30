import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight', () => {
  const tmpDirs: string[] = [];
  afterEach(() => {
    for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
  });

  it('aggregates the fixture night into 5 jobs with 1 bad line', () => {
    const rows = readNight('runs', '2026-10-28');
    expect(rows).not.toBeNull();
    expect(rows!.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    for (const row of rows!) expect(row.badLines).toBe(1);
  });

  it('returns null for a missing night', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  it('keeps a row with null owner', () => {
    const row = readNight('runs', '2026-10-28')!.find((r) => r.job === 'digest/render');
    expect(row).toBeDefined();
    expect(row!.owner).toBeNull();
  });

  it('gets retries, lastStatus and lastError right for fixtures/refresh', () => {
    const row = readNight('runs', '2026-10-28')!.find((r) => r.job === 'fixtures/refresh')!;
    expect(row.runs).toBe(4);
    expect(row.retries).toBe(3);
    expect(row.lastStatus).toBe('ok');
    expect(row.lastError).toBe('upstream 503');
    expect(row.firstAt).toBe('2026-10-29T01:30:00+01:00');
    expect(row.lastAt).toBe('2026-10-29T01:37:00+01:00');
  });

  it('returns [] for an empty night file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    tmpDirs.push(dir);
    writeFileSync(join(dir, '2026-10-30.jsonl'), '');
    expect(readNight(dir, '2026-10-30')).toEqual([]);
  });
});

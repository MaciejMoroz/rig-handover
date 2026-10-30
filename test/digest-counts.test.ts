import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { nightCounts } from '../src/digest/counts.js';

describe('nightCounts', () => {
  const tmpDirs: string[] = [];
  afterEach(() => {
    for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
  });

  it('counts the fixture night', () => {
    expect(nightCounts('runs', '2026-10-28')).toEqual({ ok: 10, retry: 4, fail: 1, bad: 1 });
  });

  it('returns null for a missing night', () => {
    expect(nightCounts('runs', '1999-01-01')).toBeNull();
  });

  it('counts bad lines without throwing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-counts-'));
    tmpDirs.push(dir);
    writeFileSync(
      join(dir, '2026-10-30.jsonl'),
      [
        '{"at":"2026-10-30T01:00:00+01:00","job":"a","status":"ok","owner":null}',
        'not json',
        '{"at":"2026-10-30T02:00:00+01:00","job":"a","status":"retry","owner":null}',
        '',
      ].join('\n'),
    );
    expect(nightCounts(dir, '2026-10-30')).toEqual({ ok: 1, retry: 1, fail: 0, bad: 1 });
  });
});

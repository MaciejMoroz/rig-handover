import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

let runsDir: string;
let config: RigConfig;

const fullNight = [
  { at: '2026-10-28T02:00:00Z', job: 'rig/rotate-logs', status: 'ok', owner: 'lane-07' },
  { at: '2026-10-28T02:01:00Z', job: 'lane/sync', status: 'ok', owner: 'lane-07' },
  { at: '2026-10-28T02:02:00Z', job: 'lane/sync', status: 'retry', owner: 'lane-07', error: 'upstream 503' },
  { at: '2026-10-28T02:03:00Z', job: 'lane/sync', status: 'ok', owner: 'lane-07' },
].map((l) => JSON.stringify(l)).join('\n');

beforeAll(async () => {
  runsDir = await mkdtemp(join(tmpdir(), 'rig-runs-'));
  config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
  await writeFile(join(runsDir, '2026-10-28.jsonl'), fullNight + '\n');
  await writeFile(join(runsDir, '2026-10-29.jsonl'), '');
  await writeFile(join(runsDir, '2026-10-30.jsonl'), `{not json}\n{"at":"2026-10-30T02:00:00Z","job":"lane/sync","status":"ok","owner":"lane-07"}\n`);
});

afterAll(async () => {
  await rm(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('renders the night table with jobs sorted', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('<th>job</th>');
    expect(html).toContain('lane/sync');
    expect(html.indexOf('lane/sync')).toBeLessThan(html.indexOf('rig/rotate-logs'));
  });

  it('404s for a night with no file', async () => {
    const res = await createApp(config).request('/digest/1999-01-01');
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for an empty night', async () => {
    const res = await createApp(config).request('/digest/2026-10-29');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table>');
  });

  it('still renders 200 when the night has a bad line', async () => {
    const res = await createApp(config).request('/digest/2026-10-30');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the night rows sorted by job', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: Array<Record<string, unknown>> };
    expect(body.night).toBe('2026-10-28');
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync', 'rig/rotate-logs']);
    const sync = body.rows[0]!;
    expect(sync.runs).toBe(3);
    expect(sync.retries).toBe(1);
    expect(sync.lastStatus).toBe('ok');
    expect(sync.lastError).toBe('upstream 503');
    expect(sync.firstAt).toBe('2026-10-28T02:01:00Z');
    expect(sync.lastAt).toBe('2026-10-28T02:03:00Z');
  });

  it('404s with an error body for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/1999-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'night not found' });
  });

  it('returns rows: [] for an empty night', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-29');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-29', rows: [] });
  });

  it('counts a bad line instead of throwing', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: Array<Record<string, unknown>> };
    expect(body.night).toBe('2026-10-30');
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]!.job).toBe('lane/sync');
    expect(body.rows[0]!.badLines).toBe(1);
  });
});

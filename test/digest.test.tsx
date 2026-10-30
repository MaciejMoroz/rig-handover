import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders the night table with jobs sorted', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('<th>job</th>');
    expect(html).toContain('lane/sync');
    expect(html.indexOf('lane/sync')).toBeLessThan(html.indexOf('rig/rotate-logs'));
  });

  it('404s for a missing night', async () => {
    const res = await createApp(config).request('/digest/1999-01-01');
    expect(res.status).toBe(404);
  });
});

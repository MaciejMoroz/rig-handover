import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readNight } from './digest/reader.js';
import { readStatus } from './status.js';
import { DigestTable } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const rows = readNight(config.runsDir, night);
    if (rows === null) return c.json({ error: 'night not found' }, 404);
    return c.json({ night, rows });
  });

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const rows = readNight(config.runsDir, c.req.param('night'));
    if (rows === null) return c.text('not found', 404);
    return c.html(
      <Layout title="digest" lane={lane()}>
        <DigestTable night={c.req.param('night')} rows={rows} />
      </Layout>,
    );
  });

  return app;
}

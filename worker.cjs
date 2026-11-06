const fs = require('fs');
const log = [];
const logf = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x, null, 1)).join(' '); log.push(s); console.log(s); };

const URL_ = process.env.JOB1_URL;
if (!URL_) throw new Error('JOB1_URL missing');

let id = 0;
async function rpc(method, params) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params || {} }),
  });
  const text = await res.text();
  logf(`>> ${method} ${JSON.stringify(params || {})}`);
  logf(`<< status=${res.status} ${text}`);
  let body;
  try { body = JSON.parse(text); } catch { throw new Error('non-JSON reply: ' + text.slice(0, 300)); }
  if (body.error) throw new Error('rpc error: ' + JSON.stringify(body.error));
  return body.result;
}
async function notify(method) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', method }),
  });
  logf(`>> notify ${method} << status=${res.status}`);
}
function contentText(result) {
  const c = result && result.content;
  if (Array.isArray(c) && c.length && c[0].type === 'text') return c[0].text;
  return JSON.stringify(result);
}
function tryParse(s) { try { return JSON.parse(s); } catch { return null; } }

(async () => {
  await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'job1-worker', version: '1' } });
  await notify('notifications/initialized');
  const toolsList = await rpc('tools/list');
  const tools = (toolsList.tools || []).map(t => t.name);
  logf('TOOLS: ' + tools.join(', '));
  const schemas = {};
  for (const t of toolsList.tools || []) {
    schemas[t.name] = Object.keys((t.inputSchema && t.inputSchema.properties) || {});
  }
  logf('SCHEMAS: ' + JSON.stringify(schemas));

  const has = (tool) => tools.includes(tool);
  if (!has('search')) throw new Error('no search tool');

  for (let attempt = 1; attempt <= 3; attempt++) {
    logf(`ATTEMPT ${attempt}`);
    const searchRaw = contentText(await rpc('tools/call', { name: 'search', arguments: { scope: 'ops/live' } }));
    const searchRes = tryParse(searchRaw);
    logf('SEARCH RAW: ' + searchRaw);
    if (!searchRes) throw new Error('search result not JSON');
    const step1 = searchRes.step;
    const entries = searchRes.entries || searchRes.results || searchRes.items || searchRes.records || [];
    if (!Array.isArray(entries) || !entries.length) throw new Error('no entries in search result: ' + contentText({content:[{type:'text',text:JSON.stringify(searchRes)}]}));
    const hit = entries.find(e => /tram[- _]?3\b/i.test(JSON.stringify(e)));
    if (!hit) throw new Error('no tram-3 entry');
    logf('TRAM-3 ENTRY: ' + JSON.stringify(hit));
    const entryId = hit.id || hit.entryId || hit.ref || hit.key || hit.name || hit.uri || hit.path;
    if (entryId === undefined) throw new Error('cannot find entry id field');

    const readProps = schemas['read'] || ['id', 'fields'];
    const readArgs = { fields: ['date', 'time', 'clock', 'line', 'cause'] };
    for (const p of readProps) {
      if (p !== 'fields' && p !== 'step') readArgs[p] = entryId;
    }
    if (step1 !== undefined && readProps.includes('step')) readArgs.step = step1;
    logf('READ ARGS: ' + JSON.stringify(readArgs));
    const readRes = tryParse(contentText(await rpc('tools/call', { name: 'read', arguments: readArgs })));
    logf('READ PARSED: ' + JSON.stringify(readRes));
    if (!readRes) throw new Error('read result not JSON');
    const step2 = readRes.step;
    const fields = readRes.record || readRes.entry || readRes.fields || readRes;
    if (typeof fields !== 'object') throw new Error('read result has no record');

    const lines = [];
    for (const f of ['date', 'time', 'clock', 'line', 'cause']) {
      if (fields[f] !== undefined) lines.push(`${f}: ${fields[f]}`);
    }
    logf('REDACT LINES: ' + JSON.stringify(lines));
    const redactArgs = { text: lines.join('\n') };
    if (step2 !== undefined && (schemas['redact'] || ['text', 'step']).includes('step')) redactArgs.step = step2;
    const redactRes = tryParse(contentText(await rpc('tools/call', { name: 'redact', arguments: redactArgs })));
    logf('REDACT PARSED: ' + JSON.stringify(redactRes));
    if (!redactRes) throw new Error('redact result not JSON');
    const step3 = redactRes.step;
    const redacted = redactRes.text || redactRes.result || redactRes.redacted;
    if (typeof redacted !== 'string') throw new Error('redact result has no text');

    const submitArgs = { result: redacted, skillVersion: '1' };
    if (step3 !== undefined && (schemas['submit'] || ['result', 'skillVersion', 'step']).includes('step')) submitArgs.step = step3;
    const submitRes = tryParse(contentText(await rpc('tools/call', { name: 'submit', arguments: submitArgs })));
    logf('SUBMIT PARSED: ' + JSON.stringify(submitRes));
    if (!submitRes) throw new Error('submit result not JSON');
    if (submitRes.status === 'accepted' || submitRes.accepted === true) {
      fs.writeFileSync('result.txt', typeof submitRes.result === 'string' ? submitRes.result : JSON.stringify(submitRes.result, null, 2));
      fs.writeFileSync('receipt.txt', String(submitRes.receipt || ''));
      fs.writeFileSync('worker-log.md', log.join('\n\n'));
      logf('DONE');
      return;
    }
    const msg = submitRes.error || submitRes.message || JSON.stringify(submitRes);
    if (/token|step/i.test(msg)) { logf('Step token problem, restarting from step 1: ' + msg); continue; }
    throw new Error('submit refused: ' + msg);
  }
  throw new Error('all attempts failed');
})().catch(e => {
  fs.writeFileSync('worker-log.md', log.concat('FATAL: ' + e.message).join('\n\n'));
  console.error(e);
  process.exit(1);
});

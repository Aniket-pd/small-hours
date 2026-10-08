import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createServer } from '../src/server.mjs';

const hostPort = 4319;
const activities = [{
  id: 'observation', title: 'Outdoor detail', description: 'Notice one outdoor detail.',
  minMinutes: 5, movement: 'seated', terrain: 'built', requirements: [], tags: ['observe'],
  equipment: [], semanticText: 'Notice outdoors', takeaway: 'One detail noticed.',
  steps: [
    { title: 'Settle', detail: 'Choose a familiar outdoor spot.' },
    { title: 'Observe', detail: 'Notice the details.' },
    { title: 'Finish', detail: 'Wrap up.' },
  ],
}];
const input = { query: 'Notice outdoors', minutes: 10, movement: 'seated', setting: 'urban', company: 'solo', daylight: true };

// Deterministic request-boundary fixtures: a TCP stack may coalesce writes, so
// invoke the real HTTP listener with controlled chunks for these edge cases.
async function dispatchChunks({ url = '/api/plan', chunks = [], rank }) {
  const server = createServer({
    activities, state: { mode: 'fixture', ready: true, model: null }, port: hostPort,
    rank: rank ?? (async () => [{ id: 'observation', score: 0.5 }]),
  });
  const request = {
    method: 'POST', url,
    headers: { host: `127.0.0.1:${hostPort}`, 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk; },
  };
  const result = { headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name.toLowerCase()] = value; },
    writeHead(status, headers) { result.status = status; Object.assign(result.headers, headers); },
    end(body) { result.body = String(body ?? ''); },
  };
  await server.listeners('request')[0](request, response);
  return result;
}

async function harness(t, overrides = {}) {
  const state = overrides.state ?? { mode: 'fixture', model: null, ready: true, error: null };
  const server = createServer({
    activities, state, rank: async () => [{ id: 'observation', score: 0.5 }], port: hostPort, ...overrides,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const port = server.address().port;
  const send = ({ method = 'GET', path = '/api/status', headers = {}, body, chunks } = {}) => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port, method, path,
      headers: { Host: `127.0.0.1:${hostPort}`, ...(body !== undefined || chunks ? { 'Content-Type': 'application/json' } : {}), ...headers },
      agent: false,
    }, response => {
      const received = [];
      response.on('data', chunk => received.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(received).toString('utf8');
        resolve({ status: response.statusCode, headers: response.headers, text, json: () => JSON.parse(text) });
      });
      response.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Local test request timed out')));
    if (chunks) for (const chunk of chunks) req.write(chunk);
    else if (body !== undefined) req.write(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    req.end();
  });
  return { send, state };
}

test('status honestly labels fixture and disabled discovery and has privacy headers', async t => {
  const { send } = await harness(t);
  const response = await send();
  assert.equal(response.status, 200);
  assert.equal(response.json().mode, 'fixture');
  assert.equal(response.json().discovery.enabled, false);
  assert.equal(response.json().datasetCount, activities.length);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.match(response.headers['content-security-policy'], /connect-src 'self'/);
  assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(response.headers['permissions-policy'], /geolocation=\(\)/);
  assert.equal(response.headers['set-cookie'], undefined);
});

test('host and origin guards reject foreign requests before invoking the model', async t => {
  let rankCalls = 0;
  const { send } = await harness(t, { rank: async () => { rankCalls += 1; return []; } });
  for (const headers of [
    { Host: 'example.com' }, { Host: `evil.localhost:${hostPort}` },
    { Host: '127.0.0.1:80' }, { Origin: 'https://example.com' },
    { Origin: 'null' }, { Origin: `http://localhost:${hostPort + 1}` },
  ]) {
    const response = await send({ method: 'POST', path: '/api/plan', headers, body: input });
    assert.equal(response.status, 403);
  }
  assert.equal(rankCalls, 0);
});

test('same-origin planner request returns a budgeted plan without storing query in state or status', async t => {
  let seenQuery;
  const { send, state } = await harness(t, { rank: async query => {
    seenQuery = query;
    return [{ id: 'observation', score: 0.5 }];
  } });
  const originalState = structuredClone(state);
  const query = 'private unique test input zzyyx889';
  const response = await send({ method: 'POST', path: '/api/plan', headers: { Origin: `http://127.0.0.1:${hostPort}` }, body: { ...input, query } });
  assert.equal(response.status, 200);
  assert.equal(seenQuery, query);
  assert.equal(response.json().plan.steps.reduce((sum, step) => sum + step.minutes, 0), input.minutes);
  assert.match(response.json().note, /no AI inference/);
  assert.equal(response.text.includes(query), false);
  assert.deepEqual(state, originalState);
  assert.equal((await send()).text.includes(query), false);
  assert.equal(response.headers['set-cookie'], undefined);
});

test('planner rejects malformed JSON, wrong content type, invalid inputs, and oversized bytes', async t => {
  let rankCalls = 0;
  const { send } = await harness(t, { rank: async () => { rankCalls += 1; return []; } });
  const cases = [
    [{ body: '{broken' }, 400], [{ body: [] }, 400], [{ body: {} }, 400],
    [{ body: { ...input, minutes: '10' } }, 400],
    [{ body: input, headers: { 'Content-Type': 'text/plain' } }, 415],
    [{ body: 'x'.repeat(4097) }, 400],
    [{ chunks: [Buffer.from('{"query":"'), Buffer.from('🌳'.repeat(1100)), Buffer.from('"}')] }, 400],
  ];
  for (const [options, expected] of cases) {
    const response = await send({ method: 'POST', path: '/api/plan', ...options });
    assert.equal(response.status, expected);
    assert.equal(typeof response.json().error, 'string');
  }
  assert.equal(rankCalls, 0);
});

test('malformed request targets receive 400 without an unhandled listener rejection', async () => {
  let result;
  await assert.doesNotReject(async () => { result = await dispatchChunks({ url: 'http://[' }); });
  assert.equal(result.status, 400);
});

test('UTF-8 user text is preserved when a character spans request body chunks', async () => {
  const query = 'Notice café architecture';
  const bytes = Buffer.from(JSON.stringify({ ...input, query }));
  const split = bytes.indexOf(Buffer.from('é')) + 1;
  let receivedQuery;
  const result = await dispatchChunks({
    chunks: [bytes.subarray(0, split), bytes.subarray(split)],
    rank: async value => { receivedQuery = value; return [{ id: 'observation', score: 0.5 }]; },
  });
  assert.equal(result.status, 200);
  assert.equal(receivedQuery, query);
});

test('model-not-ready returns 503 and cannot silently invoke the fixture ranker', async t => {
  let called = false;
  const { send } = await harness(t, {
    state: { mode: 'local-model', model: null, ready: false, error: 'Local model unavailable.' },
    rank: async () => { called = true; return [{ id: 'observation', score: 1 }]; },
  });
  const response = await send({ method: 'POST', path: '/api/plan', body: input });
  assert.equal(response.status, 503);
  assert.equal(response.json().error, 'Local model unavailable.');
  assert.equal(called, false);
});

test('inference failures return an explicit sanitized error, then release the busy guard', async t => {
  let calls = 0;
  const { send } = await harness(t, { rank: async () => {
    calls += 1;
    if (calls === 1) throw new Error('private backend details and a hypothetical key');
    return [{ id: 'observation', score: 1 }];
  } });
  const failed = await send({ method: 'POST', path: '/api/plan', body: input });
  assert.equal(failed.status, 500);
  assert.match(failed.json().error, /No fallback result was produced/);
  assert.equal(failed.text.includes('private backend details'), false);
  assert.equal((await send({ method: 'POST', path: '/api/plan', body: input })).status, 200);
});

test('concurrent inference requests are bounded while status stays readable', async t => {
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  const { send } = await harness(t, { rank: async () => {
    entered(); await wait; return [{ id: 'observation', score: 1 }];
  } });
  const first = send({ method: 'POST', path: '/api/plan', body: input });
  await started;
  assert.equal((await send({ method: 'POST', path: '/api/plan', body: input })).status, 429);
  assert.equal((await send()).status, 200);
  release();
  assert.equal((await first).status, 200);
});

test('only the three listed public assets are served, with no backend, dataset, or discovery route', async t => {
  const { send } = await harness(t);
  for (const path of ['/package.json', '/src/server.mjs', '/data/activities.json', '/.env', '/../package.json', '/%2e%2e/package.json', '/api/discover', '/missing']) {
    assert.equal((await send({ path })).status, 404, path);
  }
  assert.equal((await send({ method: 'GET', path: '/api/plan' })).status, 404);
  assert.equal((await send({ method: 'POST', path: '/api/status', body: {} })).status, 404);
  for (const [path, file, type] of [['/', 'index.html', 'text/html'], ['/styles.css', 'styles.css', 'text/css'], ['/app.js', 'app.js', 'text/javascript']]) {
    const response = await send({ path });
    assert.equal(response.status, 200, path);
    assert.ok(response.headers['content-type'].startsWith(type));
    assert.equal(response.text, await readFile(new URL(`../public/${file}`, import.meta.url), 'utf8'));
  }
});

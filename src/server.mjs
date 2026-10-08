import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createPlan, fixtureRank, InputError, loadActivities } from './planner.mjs';
import { discoveryStatus } from './discovery.mjs';

const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);

function headers(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  response.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
}

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function bodyOf(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 4096) throw new InputError('Planner requests are limited to 4 KB.');
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(body); } catch { throw new InputError('Send valid JSON.'); }
}

export function createServer({ activities, state, rank, port = 4317 }) {
  const hostnames = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  let busy = false;
  return http.createServer(async (request, response) => {
    headers(response);
    if (!hostnames.has(request.headers.host)) return json(response, 403, { error: 'Open this prototype from its local loopback address.' });
    if (request.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(request.headers.origin)) {
      return json(response, 403, { error: 'Only requests from this local app are accepted.' });
    }
    let path;
    try { path = new URL(request.url, `http://127.0.0.1:${port}`).pathname; }
    catch { return json(response, 400, { error: 'Use a valid local request path.' }); }
    if (request.method === 'GET' && path === '/api/status') {
      return json(response, 200, { ...state, datasetCount: activities.length, discovery: discoveryStatus });
    }
    if (request.method === 'POST' && path === '/api/plan') {
      if (!request.headers['content-type']?.startsWith('application/json')) return json(response, 415, { error: 'Use application/json.' });
      if (!state.ready) return json(response, 503, { error: state.error ?? 'The local model is loading. Try again shortly.' });
      if (busy) return json(response, 429, { error: 'A plan is being prepared. Please try again in a moment.' });
      busy = true;
      try {
        const raw = await bodyOf(request);
        const result = await createPlan(raw, { activities, rank, mode: state.mode, model: state.model });
        return json(response, 200, result);
      } catch (error) {
        return json(response, error instanceof InputError ? 400 : 500, {
          error: error instanceof InputError ? error.message : 'Local ranking failed. Check the local setup and try again. No fallback result was produced.',
        });
      } finally { busy = false; }
    }
    if (request.method === 'GET' && publicFiles.has(path)) {
      try {
        const [file, type] = publicFiles.get(path);
        const bytes = await readFile(new URL(`../public/${file}`, import.meta.url));
        response.writeHead(200, { 'Content-Type': type });
        return response.end(bytes);
      } catch { return json(response, 500, { error: 'A local interface file is missing.' }); }
    }
    return json(response, 404, { error: 'Not found.' });
  });
}

export async function start({ fixture = process.argv.includes('--fixture'), port = Number(process.env.PORT ?? 4317) } = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer from 1024 to 65535.');
  const activities = await loadActivities();
  const state = { mode: fixture ? 'fixture' : 'local-model', ready: fixture, model: null, error: null };
  let rank = fixtureRank;
  const server = createServer({ activities, state, rank: (...args) => rank(...args), port });
  await new Promise((resolveStart, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolveStart);
  });
  console.log(`Small Hours: http://127.0.0.1:${port} (${state.mode})`);
  if (!fixture) {
    try {
      const runtime = await import('./model.mjs');
      await runtime.loadModel();
      rank = runtime.rank;
      state.model = runtime.modelInfo;
      state.ready = true;
      console.log('Local CPU model ready. Runtime network access is disabled.');
    } catch (error) {
      state.error = 'Local model unavailable. Run npm install and npm run setup:model, then restart. For a labeled non-AI demo, use npm run demo.';
      console.error(state.error);
      console.error(`Setup detail: ${String(error.message).slice(0, 500)}`);
    }
  }
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  start().catch(error => { console.error(error.message); process.exitCode = 1; });
}

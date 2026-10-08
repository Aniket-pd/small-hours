import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

// Synthetic prompts only. Target is deliberately fixed to our private loopback.
const base = 'http://127.0.0.1:4317';
const statusResponse = await fetch(`${base}/api/status`);
assert.equal(statusResponse.status, 200);
const status = await statusResponse.json();
assert.equal(status.mode, 'local-model');
assert.equal(status.ready, true);
assert.equal(status.model.offline, true);
assert.equal(status.discovery.enabled, false);
const assets = [];
for (const path of ['/', '/styles.css', '/app.js']) {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('content-security-policy')?.includes("connect-src 'self'"));
  const content = await response.text();
  assert.ok(content.length > 100);
  assets.push({ path, bytes: Buffer.byteLength(content), contentType: response.headers.get('content-type') });
}
const examples = [
  { query: 'I want to quietly observe feathered wildlife while seated', minutes: 15, movement: 'seated', setting: 'green', daylight: true, company: 'solo' },
  { query: 'I want a quiet break, no walking, alone after dark, no parks', minutes: 5, movement: 'any', setting: 'urban', daylight: false, company: 'together' },
  { query: 'Look for repeating geometric shapes in buildings on a short walk', minutes: 15, movement: 'gentle', setting: 'urban', daylight: true, company: 'solo' },
];
const cases = [];
for (const input of examples) {
  const response = await fetch(`${base}/api/plan`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  assert.equal(response.status, 200);
  const output = await response.json();
  assert.equal(output.mode, 'local-model');
  for (const plan of [output.plan, ...output.alternatives]) {
    assert.equal(plan.steps.reduce((sum, step) => sum + step.minutes, 0), input.minutes);
  }
  cases.push({ input, output });
}
assert.equal(cases[0].output.plan.id, 'wildlife-watch');
assert.equal(cases[1].output.plan.movement, 'seated');
assert.ok(!cases[1].output.plan.requirements.includes('daylight'));
assert.ok(!cases[1].output.plan.requirements.includes('green-space'));
assert.ok(!cases[1].output.plan.requirements.includes('companion'));
const report = { verifiedAt: new Date().toISOString(), result: 'PASS: live local-model HTTP requests and static asset delivery', status, assets, cases };
await writeFile(new URL('../evidence/api-smoke.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ result: report.result, mode: status.mode, cases: cases.map(c => ({ query: c.input.query, chosen: c.output.plan.id, elapsedMs: c.output.elapsedMs })) }, null, 2));

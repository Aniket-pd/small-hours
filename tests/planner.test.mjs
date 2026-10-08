import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlan, eligibleActivities, fixtureRank, inferRestrictions, InputError, loadActivities, validateInput } from '../src/planner.mjs';

const request = (changes = {}) => ({
  query: 'Notice interesting outdoor details', minutes: 15, movement: 'any',
  setting: 'any', company: 'together', daylight: true, ...changes,
});
const activity = (id, changes = {}) => ({
  id, title: id, description: 'An outdoor observation activity.', minMinutes: 5,
  movement: 'seated', terrain: 'built', requirements: [], tags: ['observe'],
  equipment: [], semanticText: 'Notice interesting outdoor details',
  takeaway: 'One detail noticed outdoors.',
  steps: [
    { title: 'Choose a spot', detail: 'Choose a familiar outdoor spot.' },
    { title: 'Notice', detail: 'Notice a detail around you.' },
    { title: 'Return', detail: 'Wrap up and return when ready.' },
  ], ...changes,
});
const corpus = [
  activity('seated'),
  activity('gentle', { movement: 'gentle' }),
  activity('active', { movement: 'active' }),
  activity('long', { minMinutes: 30 }),
  activity('sun', { requirements: ['daylight'] }),
  activity('companion', { requirements: ['companion'] }),
  activity('park', { requirements: ['green-space'] }),
  activity('trail', { terrain: 'natural' }),
  activity('social', { tags: ['social'] }),
];
const idsFor = (input) => eligibleActivities(corpus, request(input)).eligible.map(a => a.id);

test('input accepts the documented boundary budgets and strips unrelated data', () => {
  for (const minutes of [5, 60]) {
    const validated = validateInput(request({ query: '  Look around  ', minutes, location: 'not used', key: 'not used' }));
    assert.equal(validated.query, 'Look around');
    assert.equal(validated.minutes, minutes);
    assert.equal('location' in validated, false);
    assert.equal('key' in validated, false);
  }
});

test('invalid requests are rejected before ranking', async () => {
  const invalid = [
    null, [], 'outdoors', {}, request({ query: null }), request({ query: '  ' }),
    request({ query: 'x'.repeat(601) }), request({ minutes: 4 }), request({ minutes: 61 }),
    request({ minutes: 10.5 }), request({ minutes: '15' }), request({ minutes: NaN }),
    request({ movement: 'running' }), request({ setting: 'unknown' }),
    request({ company: 'anything' }), request({ daylight: 'true' }),
  ];
  let rankCalls = 0;
  for (const input of invalid) {
    await assert.rejects(createPlan(input, {
      activities: corpus, rank: async () => { rankCalls += 1; return []; }, mode: 'fixture',
    }), InputError);
  }
  assert.equal(rankCalls, 0);
});

test('time, movement, company, daylight and urban restrictions eliminate incompatible activities', () => {
  assert.equal(idsFor({ minutes: 5 }).includes('long'), false);
  assert.equal(idsFor({ movement: 'gentle' }).includes('active'), false);
  const seated = idsFor({ movement: 'seated' });
  assert.equal(seated.includes('gentle'), false);
  assert.equal(seated.includes('active'), false);
  assert.equal(idsFor({ company: 'solo' }).includes('companion'), false);
  assert.equal(idsFor({ daylight: false }).includes('sun'), false);
  const urban = idsFor({ setting: 'urban' });
  assert.equal(urban.includes('park'), false);
  assert.equal(urban.includes('trail'), false);
  assert.ok(urban.includes('seated'));
});

test('explicit prose restrictions take precedence over permissive form selections before ranking', async () => {
  const result = await createPlan(request({
    query: 'No walking, on my own, after dark, no parks, and no talking.',
  }), {
    activities: corpus,
    rank: async (_query, candidates) => {
      assert.deepEqual(candidates.map(a => a.id), ['seated']);
      return [{ id: 'active', score: 1 }, { id: 'seated', score: 0.2 }];
    },
    mode: 'fixture', model: null,
  });
  assert.equal(result.plan.id, 'seated');
  assert.equal(result.constraints.eligibleCount, 1);
  assert.equal(result.constraints.applied.length, 5);
});

test('green surroundings exclude city-only activities while retaining flexible nature activities', async () => {
  const activities = await loadActivities();
  const { eligible } = eligibleActivities(activities, request({ setting: 'green' }));
  assert.ok(eligible.some(a => a.id === 'sound-map'));
  assert.ok(eligible.some(a => a.id === 'wildlife-watch'));
  assert.ok(!eligible.some(a => a.id === 'architecture-alphabet'));
  assert.ok(!eligible.some(a => a.id === 'pavement-patterns'));
});

test('supported no-walking phrases include typographic apostrophes and capitalization', () => {
  for (const query of ['NO WALKING', 'I can’t walk', 'without walking', 'remain seated', 'seated only']) {
    assert.equal(inferRestrictions(query).seated, true, query);
  }
});

test('no eligible activity is an explicit input error and never invokes a ranker', async () => {
  let called = false;
  await assert.rejects(createPlan(request({ minutes: 5 }), {
    activities: [activity('long', { minMinutes: 30 })],
    rank: async () => { called = true; return []; }, mode: 'fixture',
  }), /No curated activity fits/);
  assert.equal(called, false);
});

test('all generated plans allocate the entire budget without negative or missing steps', async () => {
  for (let minutes = 5; minutes <= 60; minutes += 1) {
    const result = await createPlan(request({ minutes }), {
      activities: corpus, rank: fixtureRank, mode: 'fixture', model: null,
    });
    for (const plan of [result.plan, ...result.alternatives]) {
      assert.equal(plan.steps.length, 3);
      assert.equal(plan.totalMinutes, minutes);
      assert.equal(plan.steps.reduce((sum, step) => sum + step.minutes, 0), minutes);
      assert.ok(plan.steps.every(step => Number.isInteger(step.minutes) && step.minutes > 0));
    }
  }
});

test('fixture mode is explicitly labeled as non-AI and does not echo user text', async () => {
  const privateQuery = 'my private unique preference zzqwr789';
  const result = await createPlan(request({ query: privateQuery }), {
    activities: corpus, rank: fixtureRank, mode: 'fixture', model: null,
  });
  assert.equal(result.mode, 'fixture');
  assert.equal(result.model, null);
  assert.match(result.note, /no AI inference/);
  assert.equal(JSON.stringify(result).includes(privateQuery), false);
});

test('model mode reports actual model metadata and describes template-based plans', async () => {
  const model = { name: 'injected test model', local: true };
  const result = await createPlan(request(), {
    activities: corpus, rank: async () => [{ id: 'seated', score: 0.75 }], mode: 'local-model', model,
  });
  assert.equal(result.mode, 'local-model');
  assert.deepEqual(result.model, model);
  assert.match(result.note, /editorial templates/);
  assert.match(result.note, /not a confidence or safety score/);
});

test('failed model inference is propagated rather than replaced by fixture results', async () => {
  const failure = new Error('simulated local model failure');
  await assert.rejects(createPlan(request(), {
    activities: corpus, mode: 'local-model', rank: async () => { throw failure; },
  }), error => error === failure);
});

test('unknown and nonfinite ranked results cannot become plans', async () => {
  const result = await createPlan(request(), {
    activities: corpus, mode: 'local-model', rank: async () => [
      { id: 'invented-venue', score: 1 }, { id: 'seated', score: NaN },
      { id: 'gentle', score: Infinity }, { id: 'sun', score: 0.3 },
    ],
  });
  assert.equal(result.plan.id, 'sun');
  assert.deepEqual(result.alternatives, []);
  await assert.rejects(createPlan(request(), {
    activities: corpus, mode: 'local-model', rank: async () => [{ id: 'not-in-corpus', score: 1 }],
  }), /did not produce a usable result/);
});

test('the actual curated dataset produces feasible plans across supported form choices', async () => {
  const activities = await loadActivities();
  assert.ok(activities.length >= 6, 'Enough distinct curated options should exist.');
  for (const movement of ['any', 'gentle', 'seated']) {
    for (const daylight of [false, true]) {
      for (const minutes of [5, 15, 60]) {
        const input = request({ movement, daylight, minutes, setting: 'urban', company: 'solo' });
        const result = await createPlan(input, { activities, rank: fixtureRank, mode: 'fixture', model: null });
        for (const plan of [result.plan, ...result.alternatives]) {
          assert.equal(plan.steps.reduce((sum, step) => sum + step.minutes, 0), minutes);
          assert.equal(plan.requirements.includes('green-space'), false);
          assert.equal(plan.requirements.includes('companion'), false);
          if (!daylight) assert.equal(plan.requirements.includes('daylight'), false);
          if (movement === 'seated') assert.equal(plan.movement, 'seated');
          if (movement === 'gentle') assert.notEqual(plan.movement, 'active');
        }
      }
    }
  }
});

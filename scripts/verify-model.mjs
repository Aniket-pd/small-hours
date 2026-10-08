import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { MODEL } from '../src/model-config.mjs';

// Fail every fetch during the entire model import/load/ranking sequence.
let attemptedNetworkCalls = 0;
globalThis.fetch = async () => {
  attemptedNetworkCalls += 1;
  throw new Error('Network is forbidden during offline model verification.');
};
const { loadModel, embed, rank, cosineSimilarity, getModelStatus } = await import('../src/model.mjs');
const started = performance.now();
const extractor = await loadModel();
const loadMs = performance.now() - started;
const longInput = extractor.tokenizer('trees '.repeat(350), { truncation: true });
assert.equal(longInput.input_ids.dims[1], MODEL.maxTokens, 'Long text must truncate at 256 word pieces');
const embeddingStarted = performance.now();
const vectors = await embed(['Watch birds from a park bench.', 'Watch birds from a park bench.', 'Repair a database server.']);
assert.equal(vectors.length, 3);
assert.equal(vectors[0].length, 384);
assert.ok(Math.abs(Math.hypot(...vectors[0]) - 1) < 0.00001, 'Embedding must be L2-normalized');
assert.ok(cosineSimilarity(vectors[0], vectors[1]) > 0.99999, 'Duplicate sentences must match');
assert.ok(cosineSimilarity(vectors[0], vectors[2]) < 0.8, 'Unrelated sentence should differ');
const candidates = [
  { id: 'birds', semanticText: 'Sit quietly on a bench and watch birds in a nearby park.' },
  { id: 'jog', semanticText: 'Go for an energetic brisk jog around the neighborhood.' },
  { id: 'sketch', semanticText: 'Draw an outdoor sketch of the shapes and textures of leaves.' },
];
const rankings = await rank('I want to quietly observe feathered wildlife while seated.', candidates);
assert.equal(rankings[0].id, 'birds', 'Semantic paraphrase must rank bird watching highest');
assert.equal(attemptedNetworkCalls, 0, 'No runtime fetch may be attempted');
const report = {
  verifiedAt: new Date().toISOString(),
  result: 'PASS: actual local CPU model inference',
  platform: process.platform,
  architecture: process.arch,
  node: process.version,
  model: getModelStatus(),
  dimensions: vectors[0].length,
  longInputTruncatedTokens: longInput.input_ids.dims[1],
  normalization: Math.hypot(...vectors[0]),
  identicalSentenceCosine: cosineSimilarity(vectors[0], vectors[1]),
  unrelatedSentenceCosine: cosineSimilarity(vectors[0], vectors[2]),
  semanticParaphraseRankings: rankings,
  networkFetchAttempts: attemptedNetworkCalls,
  loadMs: Number(loadMs.toFixed(1)),
  embeddingAndRankingMs: Number((performance.now() - embeddingStarted).toFixed(1)),
  rssMiB: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
  note: 'Synthetic non-personal test prompts. Timings are one local run, not a benchmark. No model training.',
};
await mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
await writeFile(new URL('../evidence/model-spike.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

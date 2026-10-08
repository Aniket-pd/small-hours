import test from 'node:test';
import assert from 'node:assert/strict';
import { cosineSimilarity, embed, rank, getModelStatus, modelInfo } from '../src/model.mjs';

test('runtime import does not start inference and describes local CPU model truthfully', () => {
  assert.equal(getModelStatus().state, 'unloaded');
  assert.equal(modelInfo.offline, true);
  assert.equal(modelInfo.local, true);
  assert.equal(modelInfo.dtype, 'q8');
  assert.equal(modelInfo.dimensions, 384);
});

test('cosine handles arbitrary vector magnitudes and rejects undefined comparisons', () => {
  assert.ok(Math.abs(cosineSimilarity([2, 2], [5, 5]) - 1) < 1e-12);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
  assert.throws(() => cosineSimilarity([0, 0], [1, 0]), /zero vectors/);
  assert.throws(() => cosineSimilarity([NaN], [1]), /finite/);
  assert.throws(() => cosineSimilarity([1], [1, 2]), /equal/);
});

test('invalid embeddings and candidates fail before loading or downloading any model', async () => {
  await assert.rejects(embed(''), /non-empty/);
  await assert.rejects(embed(['x'.repeat(2001)]), /2000/);
  await assert.rejects(embed(Array(129).fill('text')), /128/);
  await assert.rejects(rank('query', [{ id: 'bird' }]), /semanticText/);
  assert.deepEqual(await rank('query', []), []);
  assert.equal(getModelStatus().state, 'unloaded');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverPlaces, discoveryStatus, normalizePlaces } from '../src/discovery.mjs';

test('discovery is frozen disabled, and even supplying a key makes zero requests', async () => {
  assert.equal(discoveryStatus.enabled, false);
  assert.equal(Object.isFrozen(discoveryStatus), true);
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error('must not run'); };
  for (const enabled of [undefined, false]) {
    await assert.rejects(discoverPlaces({
      query: 'public gardens', apiKey: 'test-placeholder-not-a-real-key', enabled, fetchImpl,
    }), /disabled/);
  }
  assert.equal(calls, 0);
});

test('enabled adapter rejects missing keys and invalid queries before any request', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; };
  for (const apiKey of [undefined, null, '', '  ']) {
    await assert.rejects(discoverPlaces({ query: 'public garden', apiKey, enabled: true, fetchImpl }), /key is required/);
  }
  for (const query of [undefined, '', '  ', 'ab', 'x'.repeat(201)]) {
    await assert.rejects(discoverPlaces({ query, apiKey: 'test-placeholder', enabled: true, fetchImpl }), /short public-place query/);
  }
  assert.equal(calls, 0);
});

test('normalization preserves supplied listing facts and marks them unverified', () => {
  const retrievedAt = '2026-10-08T00:00:00.000Z';
  const places = normalizePlaces({ local_results: [
    { title: 'Example Public Garden', address: 'Example Street', website: 'https://example.org/garden', rating: 4.8, open_state: 'Open' },
    { title: 'No website supplied' },
    { title: '' },
  ] }, retrievedAt);
  assert.equal(places.length, 2);
  assert.equal(places[0].title, 'Example Public Garden');
  assert.equal(places[0].address, 'Example Street');
  assert.equal(places[0].website, 'https://example.org/garden');
  assert.equal(places[0].retrievedAt, retrievedAt);
  assert.match(places[0].source, /SerpApi/);
  assert.match(places[0].verification, /Confirm access, hours, distance, and suitability/);
  assert.equal('open_state' in places[0], false);
  assert.equal('rating' in places[0], false);
  assert.equal(places[1].address, null);
  assert.equal(places[1].website, null);
});

test('normalization bounds result count and text and excludes unsafe website protocols', () => {
  const rows = normalizePlaces({ local_results: Array.from({ length: 10 }, (_, index) => ({
    title: 't'.repeat(250), address: 'a'.repeat(350),
    website: ['javascript:alert(1)', 'http://example.org', 'file:///tmp/private', 'data:text/html,bad', 'not a url'][index % 5],
  })) });
  assert.equal(rows.length, 5);
  assert.ok(rows.every(row => row.title.length === 200 && row.address.length === 300 && row.website === null));
  assert.deepEqual(normalizePlaces({}), []);
  assert.deepEqual(normalizePlaces(null), []);
  assert.deepEqual(normalizePlaces({ local_results: 'not a list' }), []);
});

test('incomplete listing entries are ignored while valid supplied facts survive', () => {
  const places = normalizePlaces({ local_results: [null, undefined, 3, {}, { title: 'Mock valid garden' }] });
  assert.equal(places.length, 1);
  assert.equal(places[0].title, 'Mock valid garden');
});

test('optional adapter uses only the explicit fake transport and returns normalized results', async () => {
  let calls = 0;
  const places = await discoverPlaces({
    query: '  public gardens  ', apiKey: 'test-placeholder-not-a-real-key', enabled: true,
    fetchImpl: async (url, options) => {
      calls += 1;
      assert.equal(url.origin, 'https://serpapi.com');
      assert.equal(url.pathname, '/search.json');
      assert.equal(url.searchParams.get('engine'), 'google_maps');
      assert.equal(url.searchParams.get('q'), 'public gardens');
      assert.equal(url.searchParams.get('type'), 'search');
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      return { ok: true, json: async () => ({ local_results: [{ title: 'Mock garden' }] }) };
    },
  });
  assert.equal(calls, 1);
  assert.equal(places[0].title, 'Mock garden');
});

test('network, HTTP and provider errors are explicit and do not expose keys or raw service details', async () => {
  const sensitive = 'test-secret-token';
  const scenarios = [
    async () => { throw new Error(`network issue ${sensitive}`); },
    async () => ({ ok: false, json: async () => ({ error: sensitive }) }),
    async () => ({ ok: true, json: async () => ({ error: sensitive }) }),
  ];
  for (const fetchImpl of scenarios) {
    await assert.rejects(discoverPlaces({ query: 'public parks', apiKey: sensitive, enabled: true, fetchImpl }), error => {
      assert.match(error.message, /^Place discovery /);
      assert.equal(error.message.includes(sensitive), false);
      return true;
    });
  }
});

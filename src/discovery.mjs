// Future opt-in adapter. The app does not call this module or expose a discovery
// route. Supplying a key alone cannot turn it on. Tests use a fake fetch.
export const discoveryStatus = Object.freeze({ enabled: false, reason: 'Future optional integration; no searches or API spending in this prototype.' });

function safeLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

export function normalizePlaces(payload, retrievedAt = new Date().toISOString()) {
  return (Array.isArray(payload?.local_results) ? payload.local_results : [])
    .filter(place => place && typeof place.title === 'string' && place.title.trim())
    .slice(0, 5).map(place => ({
      title: place.title.slice(0, 200),
      address: typeof place.address === 'string' ? place.address.slice(0, 300) : null,
      website: safeLink(place.website),
      source: 'SerpApi / Google Maps search listing', retrievedAt,
      verification: 'Search listing only. Confirm access, hours, distance, and suitability with the venue before visiting.',
    }));
}

export async function discoverPlaces({ query, apiKey, enabled = false, fetchImpl = globalThis.fetch }) {
  if (!enabled) throw new Error('Place discovery is disabled. Explicit opt-in is required.');
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('A secure caller-provided SerpApi key is required.');
  if (typeof query !== 'string' || query.trim().length < 3 || query.length > 200) throw new Error('Provide a short public-place query.');
  const url = new URL('https://serpapi.com/search.json');
  url.search = new URLSearchParams({ engine: 'google_maps', q: query.trim(), api_key: apiKey, type: 'search' }).toString();
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
  } catch { throw new Error('Place discovery could not reach the search service.'); }
  if (!response.ok) throw new Error('Place discovery returned an unsuccessful response.');
  const payload = await response.json();
  if (payload.error) throw new Error('Place discovery service rejected the query.');
  return normalizePlaces(payload);
}

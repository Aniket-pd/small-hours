# Future optional place discovery

The running app returns `discovery.enabled: false` and exposes no discovery endpoint. It never reads an API key. No SerpApi account, signup, key generation, trial, or paid request was made.

`src/discovery.mjs` is a small, unused adapter for a future authorized integration. Calling it requires both `enabled: true` and an explicit secure caller-provided key. A key alone does not activate it. It makes at most one request and does not retry; its current tests inject a fake fetch implementation.

The adapter follows the [official SerpApi Google Maps API](https://serpapi.com/google-maps-api): a `google_maps` engine search with a public-place query. It retains only a listing title, supplied address, HTTPS website, source, and retrieval timestamp. It does not invent missing details, infer travel time, or turn search results into verified safety, accessibility, opening-hours, or availability claims. A listing is evidence that a search provider returned a place, not proof that all its facts are current. Confirm directly with the venue before visiting.

Before future activation, get the user's authorization for the exact data sent and API spending, supply a key through an appropriate secret mechanism, define a per-request cost limit, and connect only public-place queries. Free-text planner input must not be automatically forwarded. The disabled scaffold does not qualify as meaningful SerpApi use for a partner prize.

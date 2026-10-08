# Curated activity data

`data/activities.json` contains 16 generic outdoor micro-adventure types created for this prototype. The entries were written with AI assistance and editorial constraints: short activities, free participation, ordinary optional equipment, no required account, no species-identification claims, and no invented venue facts. They are suggestions to review, not a dataset of verified places or professional advice.

The user chooses a reachable, familiar outdoor place they are permitted to use. A doorstep, balcony, courtyard, existing seat, paved route or familiar green space may fit an activity, but the dataset does not verify that any such place exists near the user. It does not establish opening hours, lighting, weather, route conditions, accessibility or seat availability. A future place-discovery adapter must keep retrieved place information separate from this curated content.

## Matching contract

- `semanticText` is the text intended for local embedding and semantic similarity ranking. It describes the activity; it is not an instruction to a model.
- `minMinutes` is a suggested minimum activity budget; `idealMinutes` is an editorial target, not a measured duration. Three steps can be allocated across the selected budget. Travel to and from an outdoor starting point must also fit the user's total time.
- `movement` is `seated`, `gentle` or `active`. Seated means the activity itself can be done without walking once at a suitable spot; it does not guarantee a step-free journey or accessible facilities. Active means a self-paced purposeful walk, without a fitness target.
- `terrain` is `any`, `paved` or `natural`. This describes the activity's intended setting, not the condition or accessibility of a specific surface.
- `requirements` uses only `daylight`, `green-space` and `companion`. A requirement is necessary for that entry. An empty list means none of these three prerequisites is required, not that every possible real-world condition is suitable.
- `tags` support context preferences such as `quiet`, `creative`, `noticing`, `solo`, `social`, `urban`, `nature`, `walking`, `no-walking`, `doorstep` and `active`. Quiet describes the activity's intended behavior, not a guarantee of a quiet location.
- All entries are `free`; any listed equipment is optional. The dataset makes no claim that transport to a location is free.

Hard constraints should be applied before semantic ranking. Similarity is a relevance score, not a probability, safety assessment or guarantee of enjoyment. If no entry fits the declared constraints, the planner should say so instead of relaxing constraints silently.

## Provenance and maintenance

These are original, AI-assisted descriptions authored for the local prototype on 8 October 2026. They contain no scraped reviews, personal data, location coordinates or verified venue records. The optional sketching and camera suggestions do not require uploading anything. No health benefit or wildlife sighting is promised.

When adding entries, preserve the schema, use a unique stable ID, include exactly three adaptable steps, and state necessary requirements explicitly. Keep observations separate from claims: for example, describe a leaf's visible shape rather than asserting its species. Any future user testing or human review should be recorded honestly instead of implied by the word “curated.”

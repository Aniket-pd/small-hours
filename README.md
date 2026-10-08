# Small Hours

A local outdoor micro-adventure planner. Describe what you want, choose 5–60 minutes, and get a small plan to take outside. Created on **2026-10-08** for DEV's Touch Grass challenge. The original application code is available under the [MIT license](LICENSE). **A public source release is not a DEV contest submission. No prize or income earned.**

Preview: [desktop screenshot](evidence/browser/small-hours-desktop-plan.png), [mobile screenshot](evidence/browser/small-hours-mobile-plan.png), [9.52-second actual local demo](evidence/browser/small-hours-local-demo.mp4). The completed checks include **33 automated tests and 21 real-browser checks**; see [validation details](docs/VALIDATION.md). No field test is claimed.

## Run it

Requires **Node.js 22 or newer** and npm. Tested platform and actual inference evidence are recorded in [MODEL-SPIKE.md](docs/MODEL-SPIKE.md) and [VALIDATION.md](docs/VALIDATION.md).

From this folder:

```sh
# Interface review; no install, model, or network required:
npm run demo

# Actual local AI (stop the demo with Ctrl+C first):
npm ci --ignore-scripts
npm run setup:model
npm run verify:model
npm start
```

Open **http://127.0.0.1:4317**. `PORT=4318 npm start` chooses a different loopback port. Stop with Ctrl+C. The server binds only to `127.0.0.1`; this prototype is not intended for public hosting.

`npm ci --ignore-scripts` installs locked packages without package install hooks. The native CPU runtime is shipped by the reputable ONNX Runtime package; no remote inference is used. Initial installation and model download need network access to npm/Hugging Face. After setup, the model runs offline. Allow roughly **500 MB for dependencies and 24 MB for the model**, plus normal process memory; measured sizes and memory are in the evidence. The fetch script pins the model revision, verifies its weights checksum, and writes a local manifest. Missing or invalid files produce a setup error, never a fabricated AI result.

## What the app does

1. Apply explicit constraints to a curated set of 16 generic activity types.
2. Encode the free-text preference and eligible descriptions with an open-weight MiniLM model on the CPU.
3. Rank by cosine similarity and assemble a three-part editorial plan, including time to finish and return.
4. Offer up to two alternatives, a pocket view, and a local text download.

The source model is [`sentence-transformers/all-MiniLM-L6-v2`](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), Apache-2.0. This app uses its pinned Xenova q8 ONNX export through Transformers.js. It creates 384-dimensional normalized mean-pooled embeddings. There is no generative model, training job, paid API, or cloud inference.

The **fixture demo** uses simple deterministic word overlap, prominently labeled **no AI inference**. It is useful for reviewing the interface and testing the planner without dependencies. It is not evidence that the AI path works and never activates automatically when the model fails.

## Scope and limits

Time, movement, daylight, company, and setting controls are enforced before ranking. A few explicit phrases such as “no walking,” “alone,” and “after dark” also tighten filters. Other free text is a preference for semantic ranking, not a guaranteed constraint interpreter. Use the controls for firm requirements. The time control is authoritative; time mentioned in prose is not parsed. English prompts work best.

Activities describe things you can do, **not verified places**. Choose a familiar permitted outdoor spot you can reach and return from within the budget. Seated activities describe the activity itself, not an accessibility guarantee for a route or venue. Check your actual surroundings and conditions. The app makes no weather, opening-hours, wildlife, accessibility, or health claims. It does not ask for location permission, a name, credentials, or health details.

Prompts are handled in process memory and are not logged, saved to disk, or sent to a remote model. The server has no analytics, account system, database, cookies, or browser storage. A downloaded pocket plan remains a user-created local file. The verification scripts save **synthetic test inputs** and outputs to `evidence/`.

## Optional discovery

SerpApi is **disabled and unconnected to the app**. [discovery.mjs](src/discovery.mjs) is a future adapter with an explicit opt-in and caller-supplied key gate. Tests inject fake responses; no live search was made. There is no UI toggle, environment-based auto-enabling, or key bundled in this project. Search listings would still need venue-level confirmation. See [DISCOVERY.md](docs/DISCOVERY.md). Do not claim a SerpApi partner category from this scaffold.

## Checks and project map

```sh
npm test                 # Dependency-free planner and HTTP/adapter tests
npm run verify:model     # Actual CPU inference, requires setup
```

- `src/planner.mjs`: validation, hard filters, plan assembly, labeled fixture ranker.
- `src/model*.mjs`: pinned model metadata, integrity checks, offline inference.
- `src/server.mjs`: local HTTP service and static app files.
- `public/`: dependency-free responsive interface.
- `data/activities.json`: curated activity types; [dataset notes](docs/DATASET.md).
- `scripts/`: bounded model download and reproducible inference check.
- `tests/`, `evidence/`: automated checks and recorded synthetic results.
- [Rules](docs/RULES.md), [AI and third-party attribution](docs/ATTRIBUTION.md), [reviewed article draft](docs/SUBMISSION-DRAFT.md).
- [Exact model/dependency notices](docs/THIRD-PARTY-NOTICES.md), `notices/`, and [genuine creation metadata and source hashes](evidence/provenance.json).

**AI disclosure: Fully Autonomous.** OpenAI Codex agents produced the application code, activity text, interface, documentation, and recorded software checks from the user's direction and constraints. No claim is made that the user wrote every line, tested this outdoors, or independently audited it. The original application is MIT-licensed; third-party components retain their own licenses and notices in [THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md). The package remains `private: true` to prevent accidental npm publication. If changes are made after the challenge deadline, record them here as required by the challenge.

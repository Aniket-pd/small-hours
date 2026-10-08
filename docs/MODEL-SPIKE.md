# Local model feasibility spike

**Result: actual local CPU inference is working on this Mac.** This is an embedding ranker, not a text generator. It selects among curated activity descriptions; it does not invent venue facts or claim to understand every constraint. The planner must enforce concrete constraints separately.

## Verified stack and sources

- Node.js v24.8.0, macOS arm64 in this workspace. Project requires Node 22+.
- `@huggingface/transformers` **4.3.1**, pinned exactly in `package.json` and `package-lock.json`, Apache-2.0. The [official release](https://github.com/huggingface/transformers.js/releases/tag/4.3.1) was checked on 2026-10-08. The documentation landing page still advertised 3.8.1; registry metadata and the official release identified the current version. The initial older runtime was replaced after its transitive audit findings; the final installation reported **0 vulnerabilities**.
- Native `onnxruntime-node` **1.30.0**, MIT, CPU only. ONNX Runtime's [official platform table](https://onnxruntime.ai/docs/get-started/with-javascript/node.html) includes macOS arm64 and Linux CPU support. Linux execution has not been tested here.
- Original pretrained model: [sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), Apache-2.0, approximately 22.7M parameters. The card describes English sentence/short-paragraph embeddings, 384 dimensions, and a 256-word-piece default limit.
- Downloaded compatible export: [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2), also Apache-2.0, explicitly derived from that source. Fixed revision `751bff37182d3f1213fa05d7196b954e230abad9`. We use its q8 `onnx/model_quantized.onnx`, **22,972,370 bytes**, SHA-256 `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1` (checked against upstream file metadata).
- Model vectors use attention-mask-aware mean pooling and L2 normalization, then cosine similarity. Scores are similarity values, not probabilities or guarantees.

The [official Node tutorial](https://huggingface.co/docs/transformers.js/en/tutorials/node) documents server-side pipelines and local-only model loading. The installed 4.3.1 source was also inspected: its feature-extraction pipeline does not forward a `max_length` call option, so the runtime sets the tokenizer's public configuration to 256 before inference and verifies truncation explicitly.

## What ran

`npm run verify:model` executes a fresh Node process using the downloaded q8 model. It replaces `globalThis.fetch` with a throwing stub **before importing/loading the runtime**. It verifies:

1. Actual model outputs have 384 finite dimensions and approximately unit L2 norm.
2. Repeated sentences have cosine similarity approximately 1, while an unrelated software sentence is different.
3. The paraphrase “quietly observe feathered wildlife while seated” ranks bird watching above jogging and sketching (approximately 0.606 versus 0.176 and 0.163).
4. A long synthetic input truncates to exactly 256 word pieces.
5. No fetch is attempted during import, model loading, or inference.

The latest measured output is [`evidence/model-spike.json`](../evidence/model-spike.json). The first run loaded in approximately 1.79 seconds with about 172 MiB RSS. A subsequent run with filesystem pages already cached loaded in approximately 120 ms, then completed the small embedding/ranking checks in approximately 12 ms. These are single local observations, not a benchmark or latency promise.

[`evidence/model-corpus.json`](../evidence/model-corpus.json) contains three synthetic queries ranked against all 16 curated activities, with zero attempted fetches. These raw rankings demonstrate that semantic relevance is imperfect: e.g. a general pattern-walk activity can outrank the architecture activity for a buildings query. Hard constraints belong in planner filtering, and the UI should expose alternatives rather than claim a single objectively correct match.

`node --test tests/model.test.mjs` also passes three dependency-free checks for honest unloaded status, cosine behavior/invalid vectors, and rejecting invalid inputs before any model load.

## Reproduce

```sh
npm ci --ignore-scripts
npm run setup:model
npm run verify:model
npm start
```

`npm ci` downloads trusted published runtime packages, including native ONNX CPU libraries. Install scripts were disabled in this spike and inference still worked. Dependencies occupy approximately **490 MiB** on disk; the model folder occupies approximately **23 MiB**. Peak free space needed during installation can exceed the final footprint. No Python, GPU, training, hosted inference service, account, or API key is required.

`setup:model` is the only model-network step. It downloads a fixed allowlist of files from the pinned Hugging Face revision, enforces a combined 32 MiB bound and 60-second timeout per response, verifies the q8 weights against the known checksum, and writes a local manifest with hashes. Failed downloads leave the existing complete model in place.

At runtime, `env.allowRemoteModels = false`, `local_files_only = true`, `device = 'cpu'`, and integrity checks are mandatory. An absent or mismatched model produces an explicit error. There is **no fallback** in the model module. The app's separate, explicitly labelled fixture mode is not model inference. Ordinary local inference does not store user queries on disk, and corpus caching only retains curated activity embeddings.

## Runtime API

```js
import { loadModel, rank, embed, modelInfo, getModelStatus } from './src/model.mjs';
await loadModel();
const vectors = await embed(['A quiet outdoor moment.']);
const scores = await rank('Watch wildlife while seated', [
  { id: 'birds', semanticText: 'Sit quietly and watch birds from a familiar outdoor spot.' }
]);
// scores: [{ id: 'birds', score: <actual cosine> }], descending
```

Module import alone never imports Transformers.js or loads the model. `getModelStatus()` reports `unloaded`, `loading`, `ready`, or `error`, plus model identity, revision, backend, quantization, and local/offline status. Calls fail explicitly for invalid inputs or failed initialization. This supports a responsive server status endpoint while loading occurs.

## Scope and limitations

This spike verifies local model inference and practical feasibility on the current Mac. It does not validate every recommendation, guarantee semantic constraint handling, benchmark Linux, or establish contest eligibility. Model weights were not newly trained or authored for the challenge; the new work is the local application and ranking integration. Model/runtime attribution must stay distinct from the application's AI-assisted implementation disclosure. No public publication, account action, API spending, location access, or real user-data upload was performed.

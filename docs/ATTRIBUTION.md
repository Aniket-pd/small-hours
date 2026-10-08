# Attribution and AI assistance

**AI disclosure: Fully Autonomous.** OpenAI Codex agents produced this prototype's research, architecture, implementation, documentation, and recorded validation work. The user supplied the project direction and constraints. This is not a claim that the user manually authored or independently audited every line. Actual completed checks and remaining limitations belong in the final validation evidence.

The AI used while developing this project is distinct from the open-weight model used by the app's semantic-ranking path. Fixture/demo mode is explicitly non-AI word matching. Actual inference passed `npm run verify:model` on 2026-10-08: [the generated report](../evidence/model-spike.json) records local CPU inference on macOS arm64 with Node 24.8.0, 384-dimensional normalized embeddings, and a successful semantic-paraphrase ranking. JavaScript fetch was blocked throughout that check and zero fetch attempts occurred. This is one local run, not a cross-platform benchmark or outdoor field test.

## Third-party components

| Component | Source and license | Use |
| --- | --- | --- |
| `sentence-transformers/all-MiniLM-L6-v2` | [Official model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), **Apache-2.0** | Source sentence-embedding model. |
| `Xenova/all-MiniLM-L6-v2` | [Pinned ONNX conversion](https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/751bff37182d3f1213fa05d7196b954e230abad9), **Apache-2.0** in project metadata | q8 weights, revision `751bff37182d3f1213fa05d7196b954e230abad9`; loaded locally on CPU. |
| `@huggingface/transformers` **4.3.1** | [Transformers.js](https://github.com/huggingface/transformers.js), **Apache-2.0** | Selected JavaScript runtime for tokenization, model loading, mean pooling, and normalized embeddings. |
| `onnxruntime-node` **1.30.0** | [ONNX Runtime license](https://github.com/microsoft/onnxruntime/blob/main/LICENSE), **MIT** | Installed native CPU inference dependency. |

The model's authors provide an English sentence/short-paragraph encoder for semantic similarity and retrieval. The card describes 384-dimensional embeddings and a default 256-wordpiece input limit. The project does not claim to have trained or fine-tuned this model. Its original authors and training provenance are documented in the linked card.

The application uses Node.js ESM and requires Node 22 or later. [Model configuration](../src/model-config.mjs) records the model revision, input limit, weight size, and SHA-256 checksum. Model files are installed separately; setup and runtime verification are different steps. This project does not install the Python Sentence Transformers package.

The selected runtime is 4.3.1 following dependency-audit work. Manifest, lockfile, and installed versions were checked for agreement. Additional resolved packages include `onnxruntime-common` 1.30.0 (MIT), `onnxruntime-web` 1.31.0-dev.20260914-8d85527a0 (MIT), `@huggingface/jinja` 0.5.10 (MIT), `@huggingface/tokenizers` 0.2.0 (Apache-2.0), and `sharp` 0.35.5 (Apache-2.0), as recorded in [package-lock.json](../package-lock.json). The lockfile is the full dependency inventory; this list is not exhaustive. Preserve installed upstream notices and license files when redistributing third-party material. The original application code is covered by the root [MIT license](../LICENSE); third-party material remains subject to its own terms.

## Content and sources

Activity suggestions are curated activity types and authored planning text, not a verified directory of venues. Do not attribute invented venue details, opening hours, prices, or access conditions to a model or external provider. No personal location or health information is needed for the demo.

Challenge research used the official DEV challenge page, contest-specific rules, and general rules linked in [RULES.md](RULES.md). Browser research and local file tools assisted this documentation. SerpApi is an optional future integration; this prototype does not claim a completed live integration, partner endorsement, or a SerpApi-category entry.

The approved source release includes the actual local demo and screenshots. It does not deploy an application or submit a DEV contest entry. The reviewed article preserves the Fully Autonomous disclosure and distinguishes observed software results from plans and limitations.

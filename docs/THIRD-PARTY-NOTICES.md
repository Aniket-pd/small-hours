# Third-party notices and reproducibility record

This prototype uses pretrained model weights and published runtime packages. The original application code is covered by the root [MIT license](../LICENSE). The model, runtime, and other third-party material retain their respective licenses and notices; the application license does not replace them. The package's `private: true` setting prevents accidental npm publication and does not restrict the MIT license grant.

## Model identity

| Item | Recorded value |
| --- | --- |
| Original model | [`sentence-transformers/all-MiniLM-L6-v2`](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) |
| Original model license | Apache-2.0, as declared by the source model card |
| Downloaded ONNX derivative | [`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2) |
| Derivative license | Apache-2.0, as declared in the preserved derivative model-card metadata |
| Exact derivative revision | `751bff37182d3f1213fa05d7196b954e230abad9` |
| Actual weights file | `onnx/model_quantized.onnx` (q8) |
| Weights size | 22,972,370 bytes |
| Weights SHA-256 | `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1` |
| Representation | 384-dimensional, attention-mask-aware mean pooling, L2 normalization |
| Recorded download | 2026-10-08T01:08:27.510Z |

The [preserved upstream ONNX model card](../notices/model/UPSTREAM-ONNX-MODEL-CARD.md) is copied verbatim from the pinned export. It identifies the source model and Apache-2.0 license. It does not identify the exact historical source-model revision used in conversion, so no such revision is inferred. The weights were downloaded unchanged; this application did not train or convert them. The [full model manifest](../notices/model/MODEL-MANIFEST.json) records each tokenizer/config/model-card/weights URL, byte length, and SHA-256. A [copy of the Apache-2.0 text](../notices/licenses/Apache-2.0.txt) accompanies these notices.

## Runtime dependencies

| Component | Installed version | Declared license | Purpose |
| --- | --- | --- | --- |
| `@huggingface/transformers` | 4.3.1 | Apache-2.0 | Local model and tokenizer loading, inference pipeline, pooling |
| `onnxruntime-node` | 1.30.0 | MIT | Actual native CPU inference backend |
| `onnxruntime-common` | 1.30.0 | MIT | Runtime interfaces shared by ONNX packages |
| `onnxruntime-common` (nested under Web runtime) | 1.31.0-dev.20260911-2a43ec07e | MIT | Web runtime's separately locked common package |
| `onnxruntime-web` | 1.31.0-dev.20260914-8d85527a0 | MIT | Transitive package; app explicitly selects Node CPU |
| `@huggingface/tokenizers` | 0.2.0 | Apache-2.0 | Local tokenization |
| `@huggingface/jinja` | 0.5.10 | MIT | Transitive Hugging Face templating support |
| `sharp` | 0.35.5 | Apache-2.0 | Transitive image support; no image inference used by this app |

The authoritative exact graph is [`package-lock.json`](../package-lock.json), lockfile version 3. The [`package.json`](../package.json) direct dependency is pinned to Transformers.js 4.3.1. [`notices/DEPENDENCY-MANIFEST.json`](../notices/DEPENDENCY-MANIFEST.json) preserves the exact versions, npm integrity values, resolved package URLs, declared licenses, platform restrictions, local installation state, and hashes of the package manifests. At observation the lock contained 69 package entries, of which 44 were installed on this Mac; optional packages for other platforms are included in the lock but need not be installed here.

The installed package license texts were copied verbatim into [`notices/licenses/npm/`](../notices/licenses/npm/), including subcomponent notices shipped within packages. There are 39 such files and their hashes are listed in the dependency manifest. The Apache-2.0 reference text was copied from the installed Hugging Face Transformers.js package. ONNX Runtime's [MIT license](../notices/licenses/onnxruntime/LICENSE) and [third-party notices](../notices/licenses/onnxruntime/ThirdPartyNotices.txt) were downloaded from Microsoft's official [`v1.30.0` source tag](https://github.com/microsoft/onnxruntime/tree/v1.30.0), because those text files were absent from the installed npm runtime package. The upstream third-party notice file covers the upstream distribution broadly; it is not a claim that every listed component executes in this CPU-only prototype.

## Node and packaging

The verified host runtime was **Node.js v24.8.0, macOS arm64**. The application declares Node.js `>=22`. Node is a separate prerequisite; the archive does not redistribute a Node binary. Its upstream [source release](https://nodejs.org/download/release/v24.8.0/node-v24.8.0.tar.gz) and [license](https://github.com/nodejs/node/blob/v24.8.0/LICENSE) identify its own notices. No Node license term is asserted to be an application license.

The source distribution retains `LICENSE`, `package.json`, `package-lock.json`, `notices/`, this document, and `evidence/provenance.json`. It omits `node_modules/` and `models/`: `npm ci --ignore-scripts` reconstructs locked dependencies, and `npm run setup:model` downloads the fixed model file set with checksum verification.

## Creation evidence

[`evidence/provenance.json`](../evidence/provenance.json) records SHA-256 hashes and the actual filesystem birthtime, modification time, and metadata-change time for the source/data/test/package files, README, documentation, license, and the capture script itself. All observed birthtimes are **2026-10-08 UTC**, within the stated October 5–11 calendar window; exact file counts, times, and hashes are in that evidence record. The capture does not retime or rewrite those files. The local Git repository was initialized on **2026-10-08 UTC**; its metadata-directory birthtime, branch, commit state, and remote names are captured as observed at that moment, before the next commit. Git history records subsequent publication commits. Local timestamps support chronology but are not independent proof of authorship or contest eligibility; later archive extraction can change filesystem birthtimes. Exact contest deadlines and remaining eligibility checks are documented separately in `docs/RULES.md`.

The capture can be refreshed after final edits using `node notices/record-provenance.mjs`. It reads existing file metadata and content and only writes the evidence record and manifest-hash metadata. A capture run after extracting an archive describes the extracted copy's timestamps; retain the original recorded evidence when comparing creation history.

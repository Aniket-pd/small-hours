import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { MODEL, MODEL_DIRECTORY, MODEL_FILES } from '../src/model-config.mjs';

// Explicit setup only. No input text, credentials, or inference request is sent.
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
let downloadedBytes = 0;
const staging = `${MODEL_DIRECTORY.replace(/\/$/, '')}.download-${process.pid}`;
const manifest = {
  repository: MODEL.repository,
  source: MODEL.source,
  revision: MODEL.revision,
  license: MODEL.license,
  retrievedAt: new Date().toISOString(),
  files: {},
};

async function download(file) {
  const url = `https://huggingface.co/${MODEL.repository}/resolve/${MODEL.revision}/${file}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Model download failed (${response.status}) for ${file}.`);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    downloadedBytes += chunk.length;
    bytes += chunk.length;
    if (downloadedBytes > MAX_TOTAL_BYTES) throw new Error('Model download exceeded its 32 MiB limit.');
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);
  const sha256 = createHash('sha256').update(data).digest('hex');
  if (file === 'onnx/model_quantized.onnx' &&
      (sha256 !== MODEL.weightsSha256 || bytes !== MODEL.weightsBytes)) {
    throw new Error('Downloaded model weights do not match the pinned upstream checksum.');
  }
  await writeFile(join(staging, file), data);
  manifest.files[file] = { bytes, sha256, url };
  console.log(`Verified ${file} (${bytes.toLocaleString()} bytes)`);
}

try {
  await mkdir(join(staging, 'onnx'), { recursive: true });
  for (const file of MODEL_FILES) await download(file);
  await writeFile(join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  // Replace only this task's known model directory, after all downloads verify.
  await rm(MODEL_DIRECTORY, { recursive: true, force: true });
  await rename(staging, MODEL_DIRECTORY.replace(/\/$/, ''));
  console.log(`Local model ready: ${MODEL_DIRECTORY}`);
  console.log('Inference never downloads models. Run npm run verify:model to prove the CPU path.');
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  console.error(`Model setup failed: ${error.message}`);
  process.exitCode = 1;
}

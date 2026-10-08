// Run from any directory with: node notices/record-provenance.mjs
// Reads source metadata/content and writes evidence only; never changes timestamps.
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const at = path => join(root, path);
const sha = value => createHash('sha256').update(value).digest('hex');
const readJson = async path => JSON.parse(await readFile(at(path), 'utf8'));
const pkg = await readJson('package.json');
const lock = await readJson('package-lock.json');
const inventory = await readJson('notices/DEPENDENCY-MANIFEST.json');
const model = await readJson('notices/model/MODEL-MANIFEST.json');

async function walk(folder) {
  const paths = [];
  for (const entry of await readdir(at(folder), { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}

const sourcePaths = ['LICENSE', 'README.md', 'package.json', 'package-lock.json', 'notices/record-provenance.mjs'];
for (const folder of ['src', 'public', 'data', 'scripts', 'tests', 'docs']) sourcePaths.push(...await walk(folder));
const sourceFiles = [];
for (const file of sourcePaths.sort()) {
  const metadata = await stat(at(file));
  const content = await readFile(at(file));
  sourceFiles.push({
    file, bytes: content.length, sha256: sha(content),
    birthtime: metadata.birthtime.toISOString(), birthtimeMs: metadata.birthtimeMs,
    mtime: metadata.mtime.toISOString(), ctime: metadata.ctime.toISOString(),
  });
}
inventory.manifests = sourceFiles.filter(file => ['package.json', 'package-lock.json'].includes(file.file))
  .map(({ file, bytes, sha256 }) => ({ file, bytes, sha256 }));
inventory.manifestHashesObservedAt = new Date().toISOString();
await writeFile(at('notices/DEPENDENCY-MANIFEST.json'), `${JSON.stringify(inventory, null, 2)}\n`);

const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' });
const gitRead = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
let localGit;
if (git.status === 0) {
  const metadata = await stat(at('.git'));
  const head = gitRead(['rev-parse', '--verify', 'HEAD']);
  localGit = {
    metadataDirectoryBirthtime: metadata.birthtime.toISOString(),
    branch: gitRead(['symbolic-ref', '--short', 'HEAD']).stdout.trim(),
    hasCommit: head.status === 0,
    headCommit: head.status === 0 ? head.stdout.trim() : null,
    remoteNames: gitRead(['remote']).stdout.trim().split('\n').filter(Boolean),
  };
}
let weights;
try { weights = await readFile(at('models/all-MiniLM-L6-v2-q8/onnx/model_quantized.onnx')); } catch {}
const birthtimes = sourceFiles.map(file => file.birthtime).sort();
const creationDates = [...new Set(birthtimes.map(value => value.slice(0, 10)))];
const report = {
  observedAt: new Date().toISOString(),
  method: 'Node fs.stat birthtime/mtime/ctime and SHA-256 of existing source files. No source files or their timestamps are altered by this capture.',
  limitations: 'Local filesystem timestamps support chronology; they are not independent proof of authorship or contest eligibility. A copied or extracted archive may receive different birthtimes. Hashes identify this snapshot.',
  project: {
    name: pkg.name, private: pkg.private, recordedSourceFileCount: sourceFiles.length,
    earliestSourceBirthtime: birthtimes[0], latestSourceBirthtime: birthtimes.at(-1),
    sourceCreationDatesUTC: creationDates,
    allRecordedBirthtimeDatesMatch20261008: creationDates.length === 1 && creationDates[0] === '2026-10-08',
    statedChallengeDateWindow: '2026-10-05 through 2026-10-11',
    dateWindowNote: 'Stated challenge calendar window; official timezone/deadline is documented separately in docs/RULES.md.',
  },
  git: {
    isGitRepository: git.status === 0, check: 'git rev-parse --show-toplevel', exitCode: git.status,
    ...localGit,
    note: git.status === 0 ? 'Git repository exists at observation.' : 'No Git repository in this project or its parents at observation; no commit or signature proves creation.',
  },
  runtime: { node: process.version, platform: process.platform, architecture: process.arch },
  dependencies: {
    lockfileVersion: lock.lockfileVersion, direct: pkg.dependencies,
    manifest: 'notices/DEPENDENCY-MANIFEST.json', manifestHashes: inventory.manifests,
  },
  model: {
    source: model.source, derivativeRepository: model.repository, derivativeRevision: model.revision,
    license: model.license, weightsFile: 'onnx/model_quantized.onnx',
    weightsBytes: weights?.length ?? model.files['onnx/model_quantized.onnx'].bytes,
    weightsSha256: weights ? sha(weights) : model.files['onnx/model_quantized.onnx'].sha256,
    localWeightsHashedAtThisObservation: Boolean(weights),
    matchesRecordedDownloadManifest: weights ? sha(weights) === model.files['onnx/model_quantized.onnx'].sha256 : null,
    recordedModelDownloadAt: model.retrievedAt,
    sourceCardEvidence: 'notices/model/UPSTREAM-ONNX-MODEL-CARD.md',
    completeModelFileManifest: 'notices/model/MODEL-MANIFEST.json',
    originNote: 'Derivative card identifies the source model but not the historical source revision used for conversion. No source-revision claim is inferred.',
  },
  sourceFiles,
};
await writeFile(at('evidence/provenance.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  result: 'Source provenance snapshot recorded', observedAt: report.observedAt,
  sourceFiles: sourceFiles.length, sourceCreationDatesUTC: creationDates,
  earliest: birthtimes[0], latest: birthtimes.at(-1), isGitRepository: report.git.isGitRepository,
}, null, 2));

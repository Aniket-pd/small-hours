import { fileURLToPath } from 'node:url';

export const MODEL = Object.freeze({
  source: 'sentence-transformers/all-MiniLM-L6-v2',
  repository: 'Xenova/all-MiniLM-L6-v2',
  revision: '751bff37182d3f1213fa05d7196b954e230abad9',
  license: 'Apache-2.0',
  backend: 'ONNX Runtime CPU',
  dtype: 'q8',
  dimensions: 384,
  maxTokens: 256,
  localName: 'all-MiniLM-L6-v2-q8',
  weightsSha256: 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
  weightsBytes: 22972370,
});

export const MODEL_ROOT = fileURLToPath(new URL('../models/', import.meta.url));
export const MODEL_DIRECTORY = fileURLToPath(new URL(`../models/${MODEL.localName}/`, import.meta.url));
export const MODEL_FILES = Object.freeze([
  'config.json', 'tokenizer.json', 'tokenizer_config.json',
  'special_tokens_map.json', 'README.md', 'onnx/model_quantized.onnx',
]);

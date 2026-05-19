'use strict';

// Pluggable classifier registry.
//
// Contract every adapter implements:
//   name: string                       — stable identifier, stored on Candidate
//   version: string                    — bump when behavior changes (regression tracking)
//   async classify(message) -> {
//     kind: 'recommendation' | 'announcement' | 'unknown',
//     score: number,                   — 0..1 calibrated relevance probability
//     extracted: { name?, profession?, city?, contacts?: [{contactType,value}] }
//   }
//
// `message` is a RawMessage-shaped object ({ text, lang, date, ... }).
//
// The active adapter is chosen by the CLASSIFIER env var (default 'heuristic').
// Swapping engines (e.g. heuristic -> haiku, or ollama as an offline fallback)
// requires NO pipeline changes — callers only touch getClassifier().

const heuristic = require('./adapters/heuristic');
const haiku = require('./adapters/haiku');
const ollama = require('./adapters/ollama');

const REGISTRY = {
  [heuristic.name]: heuristic,
  [haiku.name]: haiku,
  [ollama.name]: ollama,
};

function getClassifier(nameOverride) {
  const name = nameOverride || process.env.CLASSIFIER || 'heuristic';
  const adapter = REGISTRY[name];
  if (!adapter) {
    throw new Error(
      `Unknown classifier "${name}". Available: ${Object.keys(REGISTRY).join(', ')}`
    );
  }
  return adapter;
}

// Wrap an adapter result with provenance so callers always have what the
// Candidate / MiningRun schemas require.
async function classify(message, nameOverride) {
  const adapter = getClassifier(nameOverride);
  const result = await adapter.classify(message);
  return {
    kind: result.kind || 'unknown',
    score: result.score,
    extracted: result.extracted || {},
    classifierName: adapter.name,
    classifierVersion: adapter.version,
  };
}

module.exports = { getClassifier, classify, REGISTRY };

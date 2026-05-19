'use strict';

// Ollama local-LLM adapter — intentionally a stub (per the 2026-05-19 decision).
// NOT a v1 path: CPU-only inference is too slow for a year-of-history backfill
// and 7-8B extraction of UA/RU/IT code-switched chat is unreliable. Kept as a
// registered adapter so a fully-offline/zero-cost fallback can be implemented
// later with zero pipeline changes.

module.exports = {
  name: 'ollama',
  version: '0.0.0-stub',
  async classify(/* message */) {
    throw new Error(
      'ollama classifier is a deliberate stub — not a v1 path (see ADR 0001)'
    );
  },
};

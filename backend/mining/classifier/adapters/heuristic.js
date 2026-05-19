'use strict';

// Heuristic pre-filter scorer — the cost lever and the >30% candidate gate.
// Real implementation lands in M2 (issue: "Heuristic pre-filter scorer"):
// UA/RU/IT profession lexicon + request/offer intent patterns + contact
// presence -> calibrated probability, default threshold 0.30.
//
// Interface is wired now (M0) so the registry and pipeline can be built and
// tested against it; calling classify() before M2 fails loudly rather than
// silently returning fake scores.

module.exports = {
  name: 'heuristic',
  version: '0.0.0-stub',
  async classify(/* message */) {
    throw new Error('heuristic classifier not implemented yet (M2)');
  },
};

'use strict';

// Claude Haiku classifier + structured extractor. Runs ONLY on pre-filter
// survivors. Real implementation lands in M2 (issue: "Haiku classifier +
// structured extractor"): strict JSON schema, one retry on malformed output,
// per-call cost accounting against MINING_BUDGET_USD ($5 hard ceiling).
//
// Requires ANTHROPIC_API_KEY (already in backend/.env) and the @anthropic-ai
// SDK (added in M2, not a dependency yet).

module.exports = {
  name: 'haiku',
  version: '0.0.0-stub',
  async classify(/* message */) {
    throw new Error('haiku classifier not implemented yet (M2)');
  },
};

const { createTtlCache } = require('./ttlCache');

// Shared cache for reference data (professions / categories / locations /
// countries) served by both /api/reference/* and the legacy /?q= endpoints.
// Cleared whenever an admin create endpoint succeeds.
const REF_TTL_MS = 60 * 1000;

const refCache = createTtlCache(REF_TTL_MS);

module.exports = { refCache };

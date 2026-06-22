const Country = require('../database/schema/Country');
const { refCache } = require('./referenceCache');

// Cached set of known country IDs (e.g. {'IT','FR'}). Backed by the same 60s
// reference cache + 'countries' key used by the public/admin reference
// endpoints, so it shares their invalidation (cleared on admin create).
async function knownCountryIDs() {
  const countries = await refCache.get('countries', () => Country.find());
  return new Set(countries.map((c) => c.id));
}

// True only if `countryID` is a non-empty string matching a real Country doc.
// Use at write boundaries (e.g. the master draft patch) so a typo or unknown
// code can't silently persist — which, via the Master schema's `default: 'IT'`,
// could otherwise mislabel a non-Italian master as Italian.
async function isKnownCountry(countryID) {
  if (!countryID || typeof countryID !== 'string') return false;
  return (await knownCountryIDs()).has(countryID);
}

module.exports = { isKnownCountry, knownCountryIDs };

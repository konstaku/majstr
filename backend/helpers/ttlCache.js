// Minimal in-memory TTL cache for low-churn reference data. Mirrors the
// 60s ref-cache pattern already used in routes/miningReview.js.
function createTtlCache(ttlMs) {
  const store = new Map(); // key -> { value, expires }

  return {
    async get(key, loader) {
      const hit = store.get(key);
      if (hit && hit.expires > Date.now()) return hit.value;
      const value = await loader();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    },
    clear() {
      store.clear();
    },
  };
}

module.exports = { createTtlCache };

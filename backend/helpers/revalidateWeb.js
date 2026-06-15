'use strict';

// On-demand ISR ping for the public Next.js site (web/). Without it, an owner
// edit sits in stale Next caches for up to an hour: the grid (page ISR) and the
// /api/master/[id] detail route the card modal reads can disagree, so a freshly
// uploaded photo shows on the grid while the modal still renders the sigil.
//
// Env is read at CALL TIME (not module load) so the local review tool and the
// test suite pick up their own .env / overrides. No-ops when no secret is set.
function triggerWebRevalidate(label) {
  const secret = process.env.REVALIDATE_SECRET;
  const base = process.env.PUBLIC_WEB_URL || 'https://majstr.xyz';
  if (!secret) return Promise.resolve();
  return fetch(`${base}/api/revalidate?secret=${secret}`, { method: 'POST' })
    .then(() => {})
    .catch((e) => console.error(`[revalidate] ${label} failed:`, e.message));
}

module.exports = { triggerWebRevalidate };

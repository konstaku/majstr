'use strict';

// Resolution pass for a recommendation SIGNAL — decides where an endorsement
// attaches BEFORE it reaches the master-centric review screen. Given a mined /
// forwarded recommendation it returns one of:
//   - existing : points at a live master → attach as a recommendation
//   - ambiguous: matches more than one live master → admin disambiguates
//   - proposed : no live master yet — it (with siblings sharing identity) would
//                create one; grouped for review by `clusterKey`
//   - orphan   : no contact, no name, no thread hint → cannot be placed
//
// Phase 2 covers the high-precision cases (see the plan in
// meetings/2026-07-06_master-recommendations.md):
//   3a contact match          — shared contact fingerprint (strongest identity)
//   1  reply-to-announcement   — caller passes replyTargetMasterId (structural)
//   4  standalone              — name/contact identity → resolve or propose
//   3b name match              — normalized name + same city (suggest, confirm)
// Bare co-sign chains (case 2) are Phase 5 and out of scope here.
//
// Stateless: computed against the current Master collection. Persisting the
// result onto candidates / building the grouped queue is the next slice.

const { contactsToKeys } = require('./dedup');
const {
  findDuplicateMasters,
  DEFAULT_STATUSES,
} = require('../helpers/masterDuplicates');
const Master = require('../database/schema/Master');

function normName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// clusterKey groups signals that PROPOSE the same not-yet-existing master, so a
// reviewer sees them together: prefer a shared contact fingerprint, else the
// normalized name + city. null when there is no identity to group on.
function clusterKeyFor(extracted) {
  const keys = [...contactsToKeys((extracted && extracted.contacts) || [])];
  if (keys.length) return 'contact:' + keys.sort()[0];
  const nm = normName(extracted && extracted.name);
  if (nm) return 'name:' + nm + '|' + normName(extracted && extracted.city);
  return null;
}

function mark(m, matchType, confidence) {
  return {
    masterId: String(m._id),
    name: m.name || null,
    locationID: m.locationID || null,
    status: m.status,
    matchType,
    confidence,
  };
}

// signal: {
//   extracted: { name, contacts:[{contactType,value}], city },
//   locationID?,            // resolved city id — enables the name match
//   replyTargetMasterId?,   // set by the reply-graph walk (case 1)
// }
async function resolveRecommendation(signal = {}) {
  const extracted = signal.extracted || {};

  // Case 1 — thread-structural: the caller already knows the master (a reply to
  // that master's announcement / recommendation). Trust it if still live.
  if (signal.replyTargetMasterId) {
    const m = await Master.findById(signal.replyTargetMasterId)
      .select('name locationID status')
      .lean();
    if (m) return { status: 'existing', matches: [mark(m, 'thread', 1)], clusterKey: null };
  }

  // Case 3a — contact match (strongest identity).
  const byContact = await findDuplicateMasters(extracted.contacts || []);
  if (byContact.length === 1) {
    return { status: 'existing', matches: [mark(byContact[0], 'contact', 0.95)], clusterKey: null };
  }
  if (byContact.length > 1) {
    return {
      status: 'ambiguous',
      matches: byContact.map((m) => mark(m, 'contact', 0.6)),
      clusterKey: null,
    };
  }

  // Case 3b — name match (suggest; admin confirms). Requires a resolved city to
  // stay precise: a name-only match across every city is too noisy to surface.
  const nm = normName(extracted.name);
  if (nm && signal.locationID) {
    const pool = await Master.find({
      status: { $in: DEFAULT_STATUSES },
      locationID: signal.locationID,
    })
      .select('name locationID status')
      .lean();
    const named = pool.filter((m) => normName(m.name) === nm);
    if (named.length === 1) {
      return { status: 'existing', matches: [mark(named[0], 'name', 0.5)], clusterKey: null };
    }
    if (named.length > 1) {
      return {
        status: 'ambiguous',
        matches: named.map((m) => mark(m, 'name', 0.4)),
        clusterKey: null,
      };
    }
  }

  // Case 4 — no live master matches: propose one (grouped by clusterKey), unless
  // there is no identity at all → orphan.
  const clusterKey = clusterKeyFor(extracted);
  if (clusterKey) return { status: 'proposed', matches: [], clusterKey };
  return { status: 'orphan', matches: [], clusterKey: null };
}

module.exports = { resolveRecommendation, clusterKeyFor, _normName: normName };

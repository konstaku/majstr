'use strict';

// Recommendation write helpers. Keep Master.recommendationCount in lock-step
// with the Recommendation collection so the count always equals the number of
// DISTINCT authors who recommended a master — the value the card badge and the
// recommended-first sort read directly (no per-render join).

const Recommendation = require('../database/schema/Recommendation');
const Master = require('../database/schema/Master');

// Phase-1 recommender identity: a normalized display-name key. Phase 2 upgrades
// mined recommendations to the salted `fromHash` (stable across chats) so one
// person cannot double-count; until then names dedup one-author-one-count within
// a master. Returns '' for an empty name so callers can skip seeding.
function normalizeNameKey(name) {
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return n ? 'name:' + n : '';
}

// Attach one endorsement to a master, idempotently. The unique (masterID,
// authorKey) index means re-attaching the same author UPDATES the existing row
// (e.g. adds/edits the text) instead of double-counting; the count only moves on
// a genuine insert. Returns { created: boolean }.
async function attachRecommendation(input) {
  const { masterID, authorKey } = input;
  if (!masterID) throw new Error('attachRecommendation: masterID required');
  if (!authorKey) throw new Error('attachRecommendation: authorKey required');

  const set = {};
  if (input.authorName != null) set.authorName = String(input.authorName).trim();
  if (input.text != null) set.text = String(input.text);
  if (input.sourceType) set.sourceType = input.sourceType;
  if (input.sourceChatID != null) set.sourceChatID = String(input.sourceChatID);
  if (input.sourceMessageID != null) set.sourceMessageID = input.sourceMessageID;
  if (input.candidateRef) set.candidateRef = input.candidateRef;

  let created = false;
  try {
    const r = await Recommendation.updateOne(
      { masterID, authorKey },
      { $set: set, $setOnInsert: { masterID, authorKey } },
      { upsert: true }
    );
    created = r.upsertedCount === 1;
  } catch (e) {
    // Lost an insert race against a concurrent attach for the same author — the
    // row now exists, so this call is a no-op, not a new distinct author.
    if (e && e.code === 11000) created = false;
    else throw e;
  }

  if (created) {
    await Master.updateOne({ _id: masterID }, { $inc: { recommendationCount: 1 } });
  }
  return { created };
}

// Recompute a master's recommendationCount from the source of truth. For
// backfills / repair; the count is otherwise maintained incrementally above.
async function recountMaster(masterID) {
  const count = await Recommendation.countDocuments({ masterID });
  await Master.updateOne({ _id: masterID }, { $set: { recommendationCount: count } });
  return count;
}

module.exports = { attachRecommendation, recountMaster, normalizeNameKey };

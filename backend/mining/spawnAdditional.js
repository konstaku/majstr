'use strict';

// Case 5 — multiple masters named in one message. The classifier returns the
// primary lead in `extracted` and any others in `additional[]`; this turns each
// additional one into its OWN recommendation candidate so the master-centric
// review sees a signal per recommended person.
//
// Siblings share the source message (chatID, anchorMessageID, text, responder,
// thread context) but carry subIndex 1..n and their own extraction. Idempotent
// on (chatID, anchorMessageID, subIndex) — safe to re-run a batch.

// shared: the primary candidate's shared fields — chatID, anchorMessageID,
//   sourceType, messageIDs, inquiry*, responderName, text, score, classifier*,
//   runRef. Must NOT include subIndex / status / extracted (set per sibling).
// additionals: array of extracted-shaped objects (name/profession/city/contacts/…).
// region: optional city fallback stamped when an additional has no city.
async function spawnAdditionalCandidates(Candidate, shared, additionals, region) {
  const list = Array.isArray(additionals) ? additionals : [];
  let created = 0;
  for (let i = 0; i < list.length; i++) {
    const extracted = { ...(list[i] || {}) };
    if (region && !extracted.city) extracted.city = region;
    await Candidate.updateOne(
      {
        chatID: shared.chatID,
        anchorMessageID: shared.anchorMessageID,
        subIndex: i + 1,
      },
      {
        // An additional named person is always a third-party recommendation.
        $set: { ...shared, kind: 'recommendation', extracted },
        $setOnInsert: { status: 'new' },
      },
      { upsert: true }
    );
    created++;
  }
  return created;
}

module.exports = { spawnAdditionalCandidates };

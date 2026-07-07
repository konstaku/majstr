'use strict';

// Migration for the multi-master change (case 5): Candidate's unique key gained
// `subIndex`. Existing rows predate the field, so:
//   1. backfill subIndex: 0 on every candidate missing it, then
//   2. drop the old 2-field unique index ({chatID, anchorMessageID}) so the new
//      3-field one ({chatID, anchorMessageID, subIndex}) governs.
//
// Idempotent — safe to run more than once. Run against the mining DB before
// deploying the schema change:
//   MONGO_DB_NAME=majstr_mining node scripts/backfill-candidate-subindex.js

require('dotenv').config();
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const Candidate = require('../database/schema/Candidate');

async function main() {
  await runDB();

  const res = await Candidate.updateMany(
    { subIndex: { $exists: false } },
    { $set: { subIndex: 0 } }
  );
  console.log(`Backfilled subIndex: 0 on ${res.modifiedCount} candidate(s).`);

  // Drop the legacy 2-field unique index if it is still present. The new index
  // is created automatically by the schema on connect (autoIndex).
  const indexes = await Candidate.collection.indexes();
  const legacy = indexes.find(
    (ix) =>
      ix.unique &&
      ix.key &&
      ix.key.chatID === 1 &&
      ix.key.anchorMessageID === 1 &&
      ix.key.subIndex === undefined
  );
  if (legacy) {
    await Candidate.collection.dropIndex(legacy.name);
    console.log(`Dropped legacy unique index "${legacy.name}".`);
  } else {
    console.log('No legacy 2-field unique index found (already migrated).');
  }

  await Candidate.init(); // ensure the new 3-field unique index exists
  console.log('New unique index {chatID, anchorMessageID, subIndex} ensured. Done.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('backfill-candidate-subindex failed:', e.message);
  process.exit(1);
});

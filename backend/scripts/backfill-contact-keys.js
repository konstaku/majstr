'use strict';

/**
 * One-shot backfill: populate Master.contactKeys for existing rows so the
 * duplicate-by-contact check (helpers/masterDuplicates.js) works on data that
 * predates the pre-save hook. New/edited masters get keys automatically.
 *
 * Dry-run by default; pass --apply to write.
 *
 * Usage (from backend/):
 *   node scripts/backfill-contact-keys.js           # dry-run summary
 *   node scripts/backfill-contact-keys.js --apply   # write contactKeys
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const Master = require('../database/schema/Master');
const { contactsToKeys } = require('../mining/dedup');

const APPLY = process.argv.includes('--apply');

function sameKeys(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

async function main() {
  await runDB();
  const masters = await Master.find().select('_id name contacts contactKeys').lean();

  let total = 0;
  let updated = 0;
  let withKeys = 0;

  for (const m of masters) {
    total++;
    const keys = [...contactsToKeys(m.contacts || [])];
    if (keys.length) withKeys++;
    const existing = m.contactKeys || [];
    if (sameKeys(existing, keys)) continue;

    updated++;
    if (APPLY) {
      await Master.updateOne({ _id: m._id }, { $set: { contactKeys: keys } });
    }
  }

  console.log(
    `${APPLY ? 'Updated' : 'Would update'} ${updated} of ${total} masters ` +
      `(${withKeys} have at least one contact key).`
  );
  if (!APPLY && updated > 0) console.log('Re-run with --apply to write changes.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

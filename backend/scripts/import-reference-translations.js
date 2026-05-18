/**
 * Import translated reference names back into the DB.
 *
 * Reads reference-worksheet.filled.json and, for each entry, merges the
 * new-language name fields into the matching document by `id`. Only sets
 * the keys present in the file (per-key $set), so existing en/ua/ru and
 * the ua_alt/ru_alt locatives are never clobbered. Idempotent.
 *
 * Usage (from backend/), targeting whichever DB holds the data:
 *   SOURCE_DB=test node scripts/import-reference-translations.js
 *   # or MONGO_DB_NAME=majstr_staging for the staging DB
 *   # add DRY_RUN=1 to preview without writing
 *
 * Env: MONGO_URI or MONGO_PASSWORD (same as database/db.js);
 *      SOURCE_DB / MONGO_DB_NAME (default "test"); DRY_RUN.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const uri =
  process.env.MONGO_URI ||
  `mongodb+srv://0864380:${process.env.MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;
const DB = process.env.SOURCE_DB || process.env.MONGO_DB_NAME || 'test';
const DRY = !!process.env.DRY_RUN;
const FILE = path.join(__dirname, '..', 'reference-worksheet.filled.json');
// Only these get written; existing keys (incl. ua_alt/ru_alt) are preserved.
const LANGS = ['it', 'pt', 'de', 'fr', 'tr', 'es', 'ru'];

async function main() {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(DB);
    for (const [coll, entries] of Object.entries(data)) {
      let updated = 0;
      let missing = 0;
      for (const e of entries) {
        if (!e || !e.id || !e.name) continue;
        const set = {};
        for (const l of LANGS) {
          if (typeof e.name[l] === 'string' && e.name[l].trim()) {
            set[`name.${l}`] = e.name[l];
          }
        }
        if (!Object.keys(set).length) continue;
        if (DRY) {
          updated++;
          continue;
        }
        const r = await db.collection(coll).updateOne({ id: e.id }, { $set: set });
        if (r.matchedCount) updated += r.matchedCount;
        else missing++;
      }
      console.log(
        `${coll}: ${DRY ? 'would update' : 'updated'} ${updated}` +
          (missing ? `, ${missing} not found by id` : '') +
          ` (db: ${DB})`
      );
    }
    console.log(DRY ? 'DRY RUN — nothing written.' : 'Done.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});

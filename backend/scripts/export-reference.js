/**
 * Export reference collections to a translation worksheet.
 *
 * Dumps id + current name object for professions / profcategories /
 * locations / countries into a single JSON, so the translation agents
 * work from the authoritative live list (not a stale backup). Pair with a
 * future import script that writes the filled translations back.
 *
 * Usage (from backend/), pointing at whichever DB holds the data:
 *   SOURCE_DB=test node scripts/export-reference.js > reference-worksheet.json
 *
 * Env: MONGO_URI or MONGO_PASSWORD (same as database/db.js);
 *      SOURCE_DB (default "test"); MONGO_DB_NAME also honored.
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const COLLECTIONS = ['professions', 'profcategories', 'locations', 'countries'];
const uri =
  process.env.MONGO_URI ||
  `mongodb+srv://0864380:${process.env.MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;
const SOURCE_DB = process.env.SOURCE_DB || process.env.MONGO_DB_NAME || 'test';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(SOURCE_DB);
    const out = {};
    for (const name of COLLECTIONS) {
      const docs = await db
        .collection(name)
        .find({}, { projection: { _id: 0, id: 1, name: 1 } })
        .toArray();
      out[name] = docs;
    }
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    console.error(
      `Exported: ` +
        COLLECTIONS.map((c) => `${c}=${out[c].length}`).join(', ') +
        ` (db: ${SOURCE_DB})`
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});

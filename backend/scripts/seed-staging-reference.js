/**
 * Seed reference collections into an isolated (staging) database.
 *
 * Copies professions / profcategories / locations / countries from a source
 * database to a target database on the SAME cluster. Use after pointing
 * staging at its own DB via MONGO_DB_NAME, so the wizard's pickers and OG
 * generation work there. Reference data only — no user/master data copied.
 *
 * Usage (from backend/):
 *   TARGET_DB=majstr_staging node scripts/seed-staging-reference.js
 *
 * Env:
 *   MONGO_URI        full connection string (optional; else built from
 *                    MONGO_PASSWORD like database/db.js)
 *   MONGO_PASSWORD   legacy fallback to build the cluster URI
 *   SOURCE_DB        source database name (default: "test" — the current
 *                    shared default DB)
 *   TARGET_DB        REQUIRED — destination database (e.g. majstr_staging);
 *                    defaults to MONGO_DB_NAME if set
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const COLLECTIONS = ['professions', 'profcategories', 'locations', 'countries'];

const uri =
  process.env.MONGO_URI ||
  `mongodb+srv://0864380:${process.env.MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;
const SOURCE_DB = process.env.SOURCE_DB || 'test';
const TARGET_DB = process.env.TARGET_DB || process.env.MONGO_DB_NAME;

async function main() {
  if (!TARGET_DB) {
    console.error('TARGET_DB (or MONGO_DB_NAME) is required.');
    process.exit(1);
  }
  if (TARGET_DB === SOURCE_DB) {
    console.error(`Refusing to seed: TARGET_DB === SOURCE_DB ("${SOURCE_DB}").`);
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const src = client.db(SOURCE_DB);
    const dst = client.db(TARGET_DB);
    console.log(`Seeding reference data: ${SOURCE_DB} -> ${TARGET_DB}`);

    for (const name of COLLECTIONS) {
      const docs = await src.collection(name).find({}).toArray();
      if (!docs.length) {
        console.warn(`  ${name}: 0 docs in source — skipped`);
        continue;
      }
      await dst.collection(name).deleteMany({});
      await dst.collection(name).insertMany(docs, { ordered: false });
      console.log(`  ${name}: copied ${docs.length}`);
    }
    console.log('Done.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
